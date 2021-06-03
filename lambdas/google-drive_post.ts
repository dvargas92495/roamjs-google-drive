import { APIGatewayProxyHandler } from "aws-lambda";
import axios from "axios";

const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "POST",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const { operation, data } = JSON.parse(event.body);
  if (operation === "INIT") {
    return axios
      .post(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
        {},
        {
          headers: {
            "X-Upload-Content-Type": data.contentType,
            "X-Upload-Content-Length": data.contentLength,
            "Content-Type": "application/json",
            "Content-Length": "0",
          },
        }
      )
      .then((r) => ({
        statusCode: 200,
        body: JSON.stringify({
          location: r.headers.Location,
        }),
        headers,
      }))
      .catch((e) => ({
        statusCode: 500,
        body: e.response?.data || e.message,
        headers,
      }));
  } else if (operation === "UPLOAD") {
    return axios
      .put(data.uri, data.chunk, {
        headers: {
          "Content-Length": data.contentLength,
          "Content-Range": data.contentRange,
        },
      })
      .then((r) => ({
        statusCode: 200,
        body: JSON.stringify({
          data: r.data,
          headers: r.headers,
          status: r.status,
        }),
        headers,
      }))
      .catch((e) => ({
        statusCode: 500,
        body: e.response?.data || e.message,
        headers,
      }));
  }
  return {
    statusCode: 400,
    body: `Invalid operation ${operation}`,
    headers,
  };
};
