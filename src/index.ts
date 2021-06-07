import axios from "axios";
import {
  addRoamJSDependency,
  createBlock,
  createHTMLObserver,
  getDropUidOffset,
  getUids,
  localStorageGet,
  localStorageSet,
  updateBlock,
} from "roam-client";
import { getOauth } from "roamjs-components";
import mime from "mime-types";
import differenceInSeconds from "date-fns/differenceInSeconds";

// const CONFIG = toConfig("google-drive");
addRoamJSDependency("google");

const CHUNK_MAX = 256 * 1024;

const uploadToDrive = ({
  files,
  getLoadingUid,
  e,
}: {
  files: FileList;
  getLoadingUid: () => string;
  e: Event;
}) => {
  const fileToUpload = files[0];
  if (fileToUpload) {
    const oauth = getOauth("google");
    if (oauth !== "{}") {
      const { access_token, expires_in, refresh_token, node } =
        JSON.parse(oauth);
      const { time, uid: oauthUid } = node || {};
      const tokenAge = differenceInSeconds(
        new Date(),
        time ? new Date(time) : new Date(0)
      );
      const getAccessToken =
        tokenAge > expires_in
          ? axios
              .post(`https://lambda.roamjs.com/google-auth`, {
                refresh_token,
                grant_type: "refresh_token",
              })
              .then((r) => {
                const storageData = localStorageGet("oauth-google");
                const data = JSON.stringify({ refresh_token, ...r.data });
                if (storageData) {
                  localStorageSet(
                    "oauth-google",
                    JSON.stringify(
                      JSON.parse(storageData).map(
                        (at: { uid: string; text: string }) =>
                          at.uid === oauthUid
                            ? {
                                uid: at.uid,
                                data,
                                time: new Date().valueOf(),
                                text: at.text,
                              }
                            : at
                      )
                    )
                  );
                } else {
                  window.roamAlphaAPI.updateBlock({
                    block: {
                      uid: oauthUid,
                      string: data,
                    },
                  });
                }
                return r.data.access_token;
              })
          : Promise.resolve(access_token);
      const uid = getLoadingUid();
      const contentType = mime.lookup(fileToUpload.name);
      const contentLength = fileToUpload.size;
      getAccessToken
        .then((Authorization) =>
          axios
            .post(
              `${process.env.API_URL}/google-drive`,
              {
                operation: "INIT",
                data: { contentType, contentLength, name: fileToUpload.name },
              },
              { headers: { Authorization } }
            )
            .then((r) => {
              const { location } = r.data;
              const upload = (
                start: number
              ): Promise<{ url: string; mimeType: string }> => {
                updateBlock({
                  uid,
                  text: `Loading ${Math.round((100 * start) / contentLength)}%`,
                });
                const end = Math.min(start + CHUNK_MAX, contentLength);
                const reader = new FileReader();
                reader.readAsArrayBuffer(fileToUpload.slice(start, end));
                return new Promise((resolve, reject) => {
                  reader.onloadend = () => {
                    axios
                      .post(
                        `${process.env.API_URL}/google-drive`,
                        {
                          operation: "UPLOAD",
                          data: {
                            chunk: Array.from(
                              new Uint8Array(reader.result as ArrayBuffer)
                            ),
                            uri: location,
                            contentLength: end - start,
                            contentRange: `bytes ${start}-${
                              end - 1
                            }/${contentLength}`,
                          },
                        },
                        { headers: { Authorization } }
                      )
                      .then((r) =>
                        r.data.done
                          ? resolve({
                              url: `${process.env.API_URL}/google-drive?id=${r.data.id}`,
                              mimeType: r.data.mimeType,
                            })
                          : resolve(upload(r.data.start))
                      )
                      .catch(reject);
                  };
                });
              };
              return upload(0);
            })
            .then(({ url, mimeType }) => {
              updateBlock({
                uid,
                text: mimeType.includes("pdf")
                  ? `{{pdf: ${url}}}`
                  : `![](${url})`,
              });
            })
        )
        .catch((e) => {
          updateBlock({
            uid,
            text: "Failed to upload file to google drive. Email support@roamjs.com with the error below:",
          });
          createBlock({
            parentUid: uid,
            node: {
              text: e.response?.data
                ? JSON.stringify(e.response.data)
                : e.message,
            },
          });
        })
        .finally(() => {
          Array.from(document.getElementsByClassName("dnd-drop-bar"))
            .map((c) => c as HTMLDivElement)
            .forEach((c) => (c.style.display = "none"));
        });
      e.stopPropagation();
      e.preventDefault();
    }
  }
};

createHTMLObserver({
  tag: "DIV",
  className: "dnd-drop-area",
  callback: (d: HTMLDivElement) => {
    d.addEventListener("drop", (e) => {
      uploadToDrive({
        files: e.dataTransfer.files,
        getLoadingUid: () => {
          const { parentUid, offset } = getDropUidOffset(d);
          return createBlock({
            parentUid,
            order: offset,
            node: { text: "Loading..." },
          });
        },
        e,
      });
    });
  },
});

const textareaRef: { current: HTMLTextAreaElement } = {
  current: null,
};

createHTMLObserver({
  tag: "TEXTAREA",
  className: "rm-block-input",
  callback: (t: HTMLTextAreaElement) => {
    textareaRef.current = t;
    t.addEventListener("paste", (e) => {
      uploadToDrive({
        files: e.clipboardData.files,
        getLoadingUid: () => {
          const { blockUid } = getUids(t);
          return updateBlock({
            text: "Loading...",
            uid: blockUid,
          });
        },
        e,
      });
    });
  },
});

document.addEventListener("click", (e) => {
  const target = e.target as HTMLInputElement;
  if (
    target.tagName === "INPUT" &&
    target.parentElement === document.body &&
    target.type === "file"
  ) {
    target.addEventListener(
      "change",
      (e) => {
        uploadToDrive({
          files: (e.target as HTMLInputElement).files,
          getLoadingUid: () => {
            const { blockUid } = getUids(textareaRef.current);
            return updateBlock({
              text: "Loading...",
              uid: blockUid,
            });
          },
          e,
        });
      },
      { capture: true }
    );
  }
});
