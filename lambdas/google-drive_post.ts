import { APIGatewayProxyHandler } from "aws-lambda";
import axiosOriginal from "axios";
// @ts-ignore
import adapter from "axios/lib/adapters/http";

const axios = axiosOriginal.create({ adapter });

const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "POST",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const { operation, data } = JSON.parse(event.body);
  if (operation === "INIT") {
    return axios
      .post(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&access_token=${
          event.headers.Authorization || event.headers.authorization
        }`,
        { name: data.name },
        {
          headers: {
            "X-Upload-Content-Type": data.contentType,
            "X-Upload-Content-Length": `${data.contentLength}`,
            "Content-Type": "application/json",
            "Content-Length": "0",
          },
        }
      )
      .then((r) => {
        return {
          statusCode: 200,
          body: JSON.stringify({
            location: r.headers.Location || r.headers.location,
            headers: r.headers,
          }),
          headers,
        };
      })
      .catch((e) => {
        return {
          statusCode: 500,
          body: e.response?.data ? JSON.stringify(e.response?.data) : e.message,
          headers,
        };
      });
  } else if (operation === "UPLOAD") {
    const buf = new ArrayBuffer(data.chunk.length);
    const view = new Uint8Array(buf);
    data.chunk.forEach((d: number, i: number) => (view[i] = d));
    return axios
      .put(`${data.uri}&access_token=${event.headers.Authorization}`, buf, {
        headers: {
          "Content-Length": data.contentLength,
          "Content-Range": data.contentRange,
        },
      })
      .then((r) => ({
        statusCode: 200,
        body: JSON.stringify({
          id: r.data.id,
          mimeType: r.data.mimeType,
          done: true,
        }),
        headers,
      }))
      .catch((e) =>
        e.response?.status === 308
          ? {
              statusCode: 200,
              body: JSON.stringify({
                start:
                  Number(e?.response?.headers?.range.replace(/^bytes=0-/, "")) +
                  1,
                done: false,
              }),
              headers,
            }
          : {
              statusCode: 500,
              body: e.response?.data || e.message,
              headers,
            }
      );
  }
  return {
    statusCode: 400,
    body: `Invalid operation ${operation}`,
    headers,
  };
};
