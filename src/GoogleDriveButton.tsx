import { Button, Card, Spinner, Tooltip } from "@blueprintjs/core";
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { getBlockUidFromTarget, getTextByBlockUid } from "roam-client";
import { createComponentRender } from "roamjs-components";
import { getAccessToken } from "./util";

type Props = {
  blockUid: string;
};

const useSrc = ({ id, mimeType }: { id: string; mimeType: string }) => {
  const [src, setSrc] = useState("");
  useEffect(() => {
    getAccessToken().then((token) =>
      axios
        .get(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "arraybuffer",
        })
        .then((r) => {
          const u8 = new Uint8Array(r.data);
          let b64encoded = "";
          u8.forEach((u) => (b64encoded += String.fromCharCode(u)));
          setSrc(`data:${mimeType};base64,${btoa(b64encoded)}`);
        })
    );
  }, [setSrc, mimeType, id]);
  return src;
};

const PreviewPdf = ({ id, mimeType }: { id: string; mimeType: string }) => {
  const src = useSrc({ id, mimeType });
  return src ? <iframe src={src} style={{ width: "100%" }} /> : <Spinner />;
};

const PreviewImage = ({ id, mimeType }: { id: string; mimeType: string }) => {
  const src = useSrc({ id, mimeType });
  return src ? (
    <img src={src} alt={"Loading..."} style={{ width: "100%" }} />
  ) : (
    <Spinner />
  );
};

const ID_REGEX = /{{google drive:\s*(.*?)\s*}}/;

const GoogleDriveButton = ({ blockUid }: Props) => {
  const id = useMemo(
    () => ID_REGEX.exec(getTextByBlockUid(blockUid))?.[1],
    [blockUid]
  );
  const [name, setName] = useState("Unknown File");
  const [link, setLink] = useState("https://drive.google.com");
  const [mimeType, setMimeType] = useState("loading");
  useEffect(() => {
    getAccessToken().then((token) => {
      axios
        .get(
          `https://www.googleapis.com/drive/v3/files/${id}?fields=webViewLink,name,mimeType`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        .then((r) => {
          setName(r.data.name || "Unknown File");
          setLink(r.data.webViewLink);
          setMimeType(r.data.mimeType);
        })
        .catch((e) => {
          setName("Unknown File");
          setMimeType(`error: ${e.response?.data?.message || e.message}`);
        });
    });
  }, [setName, setMimeType, setLink]);
  return (
    <Card style={{ position: "relative", maxWidth: "100%", minWidth: 300 }}>
      <div>
        {mimeType.startsWith("loading") ? (
          <Spinner />
        ) : mimeType.startsWith("image") ? (
          <PreviewImage id={id} mimeType={mimeType} />
        ) : mimeType.includes("pdf") ? (
          <PreviewPdf id={id} mimeType={mimeType} />
        ) : (
          <div>Don't know how to load the following file type: {mimeType}</div>
        )}
      </div>
      <Button
        onClick={() => window.open(link, "_blank")}
        style={{ marginTop: 16 }}
      >
        <img
          src={
            "https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
          }
          style={{ height: 18 }}
        />
        <span style={{ marginLeft: 8 }}>Open {name} in Drive</span>
      </Button>
    </Card>
  );
};

export const render = createComponentRender(GoogleDriveButton);

export default GoogleDriveButton;
