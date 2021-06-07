import { getOauth } from "roamjs-components";
import differenceInSeconds from "date-fns/differenceInSeconds";
import axios from "axios";
import { localStorageGet, localStorageSet } from "roam-client";

export const getAccessToken = () => {
  const oauth = getOauth("google");
  if (oauth !== "{}") {
    const { access_token, expires_in, refresh_token, node } = JSON.parse(oauth);
    const { time, uid: oauthUid } = node || {};
    const tokenAge = differenceInSeconds(
      new Date(),
      time ? new Date(time) : new Date(0)
    );
    return tokenAge > expires_in
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
  } else {
    return Promise.resolve("");
  }
};
