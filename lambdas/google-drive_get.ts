import { APIGatewayProxyHandler } from "aws-lambda";
import axiosOriginal, { AxiosError, AxiosResponse } from "axios";
// @ts-ignore
import adapter from "axios/lib/adapters/http";

const axios = axiosOriginal.create({ adapter });

const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "POST",
};
const handleError = (e: AxiosError) => {
  return {
    statusCode: 500,
    body: e.response?.data
      ? typeof e.response.data === "string"
        ? e.response.data
        : JSON.stringify(e.response?.data)
      : e.message,
    headers,
  };
};

const passThrough = (r: AxiosResponse) => {
  return {
    statusCode: 200,
    body: JSON.stringify(r.data),
    headers,
  };
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
  const opts = {
    headers: {
      Authorization: `Bearer ${
        event.headers.Authorization || event.headers.authorization
      }`,
    },
  };
  if (meta === "true") {
    return axios
      .get(, opts)
      .then(passThrough)
      .catch(handleError);
  } else {
    return axios
      .get(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        responseType: "blob",
        ...opts,
      })
      .then(passThrough)
      .catch(handleError);
  }
};
