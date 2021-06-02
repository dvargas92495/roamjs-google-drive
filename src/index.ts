import { addRoamJSDependency, createBlock, createHTMLObserver, getPageUidByPageTitle, getUids, updateBlock } from "roam-client";
import { getOauth } from "roamjs-components";

// const CONFIG = toConfig("google-drive");
addRoamJSDependency('google');

// TODO move to roam-client
const getPageTitle = (e: Element): ChildNode => {
  const container =
    e.closest(".roam-log-page") ||
    e.closest(".rm-sidebar-outline") ||
    e.closest(".roam-article") ||
    document;
  const heading =
    (container.getElementsByClassName(
      "rm-title-display"
    )[0] as HTMLHeadingElement) ||
    (container.getElementsByClassName(
      "rm-zoom-item-content"
    )[0] as HTMLSpanElement);
  return Array.from(heading.childNodes).find(
    (n) => n.nodeName === "#text" || n.nodeName === "SPAN"
  );
};

// TODO move to roam-client
const getDropUidOffset = (
  d: HTMLDivElement
): { parentUid: string; offset: number } => {
  const separator = d.parentElement;
  const childrenContainer = separator.parentElement;
  const index = Array.from(childrenContainer.children).findIndex(
    (c) => c === separator
  );
  const offset = Array.from(childrenContainer.children).reduce(
    (prev, cur, ind) =>
      cur.classList.contains("roam-block-container") && ind < index
        ? prev + 1
        : prev,
    0
  );
  const parentBlock = childrenContainer.previousElementSibling.getElementsByClassName(
    "roam-block"
  )?.[0] as HTMLDivElement;
  const parentUid = parentBlock
    ? getUids(parentBlock).blockUid
    : getPageUidByPageTitle(getPageTitle(childrenContainer).textContent);
  return {
    parentUid,
    offset,
  };
};

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
    const oauth = getOauth('google');
    if (oauth !== "{}") {
      const { access_token } = JSON.parse(oauth);
      console.log('initialize client with', access_token);
      const uid = getLoadingUid();
      const reader = new FileReader();

      reader.readAsBinaryString(fileToUpload);

      reader.onloadend = () =>
        Promise.resolve('upload file to drive')
          .then((url) => {
            // const contentType = mime.lookup(r.result.name);
            const contentType: string = null;
            updateBlock({
              uid,
              text:
                contentType && contentType.includes("pdf")
                  ? `{{pdf: ${url}}}`
                  : `![](${url})`,
            });
          })
          .catch((e) => {
            updateBlock({
              uid,
              text: "Failed to upload file to google drive. Email support@roamjs.com with the error below:",
            });
            createBlock({
              parentUid: uid,
              node: { text: JSON.stringify(e) },
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
