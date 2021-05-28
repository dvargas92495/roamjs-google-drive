import { toConfig, createPage } from "roam-client";

const CONFIG = toConfig("google-drive");
createPage({ title: CONFIG });
