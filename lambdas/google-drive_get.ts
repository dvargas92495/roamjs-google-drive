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
  const id = event.queryStringParameters?.id;
  if (!id) {
    return {
      statusCode: 400,
      body: "id parameter is required",
      headers,
    };
  }
  const meta = event.queryStringParameters?.meta;
  if (meta) {
    return axios
      .get(`https://www.googleapis.com/drive/v3/files/${id}`, {
        headers: {
          Authorization: `Bearer ${
            event.headers.Authorization || event.headers.authorization
          }`,
        },
      })
      .then((r) => {
        return {
          statusCode: 200,
          body: JSON.stringify(r.data),
          headers,
        };
      })
      .catch((e) => {
        return {
          statusCode: 500,
          body: e.response?.data
            ? typeof e.response.data === "string"
              ? e.response.data
              : JSON.stringify(e.response?.data)
            : e.message,
          headers,
        };
      });
  } else {
    return axios
      .get(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        responseType: "blob",
        headers: {
          Authorization: `Bearer ${
            event.headers.Authorization || event.headers.authorization
          }`,
        },
      })
      .then((r) => {
        return {
          statusCode: 200,
          body: r.data,
          headers,
        };
      })
      .catch((e) => {
        return {
          statusCode: 500,
          body: e.response?.data
            ? typeof e.response.data === "string"
              ? e.response.data
              : JSON.stringify(e.response?.data)
            : e.message,
          headers,
        };
      });
  }
};
