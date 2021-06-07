import axios from "axios";
import {
  addRoamJSDependency,
  createBlock,
  createButtonObserver,
  createHTMLObserver,
  getDropUidOffset,
  getUids,
  updateBlock,
} from "roam-client";
import mime from "mime-types";
import { render } from "./GoogleDriveButton";
import { getAccessToken } from "./util";

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
    const uid = getLoadingUid();
    const contentType =
      mime.lookup(fileToUpload.name) || "application/octet-stream";
    const contentLength = fileToUpload.size;
    getAccessToken()
      .then((Authorization) =>
        Authorization
          ? axios
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
                const upload = (start: number): Promise<{ id: string }> => {
                  updateBlock({
                    uid,
                    text: `Loading ${Math.round(
                      (100 * start) / contentLength
                    )}%`,
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
                                id: r.data.id,
                              })
                            : resolve(upload(r.data.start))
                        )
                        .catch(reject);
                    };
                  });
                };
                return upload(0);
              })
              .then(({ id }) => {
                updateBlock({
                  uid,
                  text: `{{google drive:${id}}}`,
                });
              })
          : Promise.reject("Failed to get Google Access token")
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

createButtonObserver({
  shortcut: "gdrive",
  attribute: "google-drive",
  render,
});
