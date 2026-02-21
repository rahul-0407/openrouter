import { Elysia } from "elysia";
import {app as authApp} from "./modules/auth"
import {app as apiKey} from "./modules/apiKeys"

const app = new Elysia().use(authApp).use(apiKey).listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
