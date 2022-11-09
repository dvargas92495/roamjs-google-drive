import axios from "axios";
import {
  addRoamJSDependency,
  createBlock,
  createButtonObserver,
  createHTMLObserver,
  getDropUidOffset,
  getTreeByPageName,
  getUids,
  toConfig,
  updateBlock,
} from "roam-client";
import mime from "mime-types";
import { render } from "./GoogleDriveButton";
import { getAccessToken } from "./util";
import {
  createConfigObserver,
  getSettingValueFromTree,
  toFlexRegex,
} from "roamjs-components";

addRoamJSDependency("google");
const CONFIG = toConfig("google-drive");
createConfigObserver({
  title: CONFIG,
  config: {
    tabs: [
      {
        id: "upload",
        fields: [
          {
            title: "folder",
            type: "text",
            defaultValue: "RoamJS",
            description:
              "The default Google Drive folder location to send uploads to",
          },
        ],
      },
    ],
  },
});

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
    const config = getTreeByPageName(CONFIG);
    const tree = config.find((t) => toFlexRegex("upload"))?.children || [];
    const folder = getSettingValueFromTree({
      tree,
      key: "folder",
      defaultValue: "RoamJS",
    });
    getAccessToken()
      .then((Authorization) => {
        if (Authorization)
          return axios
            .get(
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
                "mimeType='application/vnd.google-apps.folder'"
              )}`,
              { headers: { Authorization: `Bearer ${Authorization}` } }
            )
            .then((r) => {
              const id = r.data.files.find(
                (f: { name: string; id: string }) => f.name === folder
              )?.id;
              if (id) {
                return id;
              }
              return axios
                .post(
                  `https://www.googleapis.com/drive/v3/files`,
                  {
                    name: folder,
                    mimeType: "application/vnd.google-apps.folder",
                  },
                  { headers: { Authorization: `Bearer ${Authorization}` } }
                )
                .then((r) => r.data.id);
            })
            .then((folderId) =>
              axios
                .post(
                  `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&access_token=${Authorization}`,
                  { name: fileToUpload.name, parents: [folderId] },
                  {
                    headers: {
                      "X-Upload-Content-Type": contentType,
                      "X-Upload-Content-Length": `${contentLength}`,
                      "Content-Type": "application/json",
                      "Content-Length": "0",
                    },
                  }
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
                          .put(
                            `${location}&access_token=${Authorization}`,
                            new Uint8Array(reader.result as ArrayBuffer),
                            {
                              headers: {
                                contentLength: (end - start).toString(),
                                contentRange: `bytes ${start}-${
                                  end - 1
                                }/${contentLength}`,
                              },
                            }
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
            );
        else {
          const err = new Error(
            "Failed to get Google Access token. Make sure you log in at [[roam/js/google]]!"
          );
          err.name = "Authentication Error";
          return Promise.reject(err);
        }
      })
      .catch((e) => {
        if (e.response?.data?.error?.code === 403) {
          updateBlock({
            uid,
            text: "Failed to upload file to google drive because of authentication. Make sure to log in through the [[roam/js/google]] page!",
          });
        } else if (e.name === "Authentication Error") {
          updateBlock({
            uid,
            text: e.message,
          });
        } else {
          updateBlock({
            uid,
            text: "Failed to upload file to google drive. Email support@roamjs.com with the error below:",
          });
          createBlock({
            parentUid: uid,
            node: {
              text: e.response?.data
                ? JSON.stringify(e.response.data)
                : e.message || "Unknown Error",
            },
          });
        }
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
