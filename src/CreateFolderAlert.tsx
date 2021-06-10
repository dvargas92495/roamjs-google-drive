import { Alert, Spinner, SpinnerSize } from "@blueprintjs/core";
import axios from "axios";
import React, { useState } from "react";
import { createOverlayRender, setInputSetting } from "roamjs-components";
import { getAccessToken } from "./util";

type Props = {
  folder: string;
};

const CreateFolderAlert = ({
  onClose,
  folder,
}: {
  onClose: () => void;
} & Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  return (
    <Alert
      isOpen={true}
      onClose={onClose}
      cancelButtonText={"Cancel"}
      confirmButtonText={"Confirm"}
      canEscapeKeyCancel
      canOutsideClickCancel
      onConfirm={() => {
        setIsLoading(true);
        setError("");
        getAccessToken().then((token) =>
          axios
            .post(
              `https://www.googleapis.com/drive/v3/files`,
              { name: folder, mimeType: "application/vnd.google-apps.folder" },
              { headers: { Authorization: `Bearer ${token}` } }
            )
            .then((r) => {
              console.log(r.data);
              onClose();
            })
            .catch((e) => {
              setError(e.error.message);
              setIsLoading(false);
            })
        );
      }}
    >
      <div>
        There's currently no folder in Drive named {folder}. Would you like to
        create one?
      </div>
      <div style={{ color: "darkred" }}>{error}</div>
      {isLoading && <Spinner size={SpinnerSize.SMALL} />}
    </Alert>
  );
};

export const render = createOverlayRender<Props>(
  "create-drive-folder",
  CreateFolderAlert
);
