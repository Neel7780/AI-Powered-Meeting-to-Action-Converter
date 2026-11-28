export const signupConfirmationPath = "/auth/confirm";

export function signupConfirmationUrl() {
  return new URL(signupConfirmationPath, window.location.origin).href;
}
