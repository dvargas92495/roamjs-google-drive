import { Button } from "@blueprintjs/core";
import axios from "axios";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { getBlockUidFromTarget, getTextByBlockUid } from "roam-client";
import { getAccessToken } from "./util";

type Props = {
  id: string;
};

const GoogleDriveButton = ({ id }: Props) => {
  const [buttonText, setButtonText] = useState("Open in Drive");
  useEffect(() => {
    getAccessToken().then((Authorization) => {
      axios
        .get(`${process.env.API_URL}/google-drive?id=${id}&meta=true`, {
          headers: { Authorization },
        })
        .then((r) => setButtonText(`Open ${r.data.name} in Drive`))
        .catch(() => setButtonText("Open Unknown File in Drive"));
    });
  }, [setButtonText]);
  return (
    <Button
      onClick={() =>
        window.open(`https://drive.google.com/file/d/${id}/view`, "_blank")
      }
    >
      <img
        src={
          "https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
        }
        style={{ height: 18 }}
      />
      <span style={{ marginLeft: 8 }}>{buttonText}</span>
    </Button>
  );
};

const ID_REGEX = /{{google drive:\s*(.*?)\s*}}/;

export const render = (b: HTMLButtonElement) => {
  const blockUid = getBlockUidFromTarget(b);
  const text = getTextByBlockUid(blockUid);
  const id = ID_REGEX.exec(text)?.[1];
  ReactDOM.render(<GoogleDriveButton id={id} />, b.parentElement);
};

export default GoogleDriveButton;
