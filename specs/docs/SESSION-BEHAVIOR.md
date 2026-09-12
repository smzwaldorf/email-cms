# CMS session renewal

CMS attempts silent renewal when its visible-page monitor sees an expired token or less than one minute remaining, and after an API 401. It also attempts renewal when restoring an expired OIDC session at startup.

Expiry and failed renewal do not automatically clear the active page's user state or redirect away. Failed renewal displays a notice with an explicit sign-in button; the current page remains mounted. Protected API requests still require valid tokens. A fresh page load still needs a usable identity before protected routes can be entered.

Explicit logout, cross-application logout and a confirmed access-revoked 403 retain their existing cleanup behavior. This changes CMS expiry UX, not Auth token lifetimes or server authorization.

Regression coverage verifies page-state preservation on failed renewal, 401 handling, the renewal notice, explicit logout and revoked-access cleanup. These expectations supersede the earlier expiry-driven automatic logout behavior.
