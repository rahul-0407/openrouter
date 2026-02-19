import { Elysia } from "elysia";
import { AuthModel } from "./models";
import { AuthService } from "./service";

export const app = new Elysia({ prefix: "/auth" })
  .post("/sign-up", async ({ body, status }) => {
    try {
      const userId = await AuthService.signup(body.email, body.password);
      return { id: userId };
    } catch (error) {
      console.log(error)
      return status(400, {
        message: "Error while signing up"
      })
    }
  }, {
    body: AuthModel.signupSchema,
    response: {
      200: AuthModel.signupResponseSchema,
      400: AuthModel.signupFailedResponseSchema,
    }
  })
  .post("/sign-in", async ({ body, status }) => {
    try {
      const token = await AuthService.signin(body.email, body.password);
      return { token };
    } catch (error) {
      return status(403, {
        message: "Incorrect credentials"
      })
    }
  }, {
    body: AuthModel.signinSchema,
    response: {
      200: AuthModel.signinResponseSchema,
      403: AuthModel.signinFailureResponseSchema,
    }
  });