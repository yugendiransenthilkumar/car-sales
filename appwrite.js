import { Client } from "appwrite";

const client = new Client()
  .setEndpoint("https://fra.cloud.appwrite.io/v1")
  .setProject("6adf71db000553af5573");

export { client };

client.ping()
  .then((res) => {
    console.log("Appwrite ping response:", res);
  })
  .catch((err) => {
    console.warn("Appwrite ping status:", err?.message || err);
  });
