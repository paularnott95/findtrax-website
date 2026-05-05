# Shopify token setup

The scanner never stores Shopify token values in git and never prints them in logs.

## Token location

For the current Missing Alerts setup, the scanner supports two practical production token paths:

1. Client credentials using `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`.
2. A static Shopify Admin API token using `SHOPIFY_ADMIN_ACCESS_TOKEN` or `SHOPIFY_ADMIN_TOKEN`.

The adjacent dashboard env currently contains client credentials by variable name. The scanner repo does not load that adjacent file automatically; export those values or add them to GitHub Actions secrets.

Expected Shopify admin location:

1. Shopify Admin
2. Settings
3. Apps and sales channels
4. Develop apps
5. Select the Missing Alerts custom/admin app
6. API credentials

Shopify shows an Admin API access token when the app is installed or reinstalled. If the full token was not saved when generated, Shopify generally does not reveal it again; generate a new token by reinstalling/rotating the app and immediately store it in secrets.

## Static Admin API token mode

Use this mode if Shopify Admin has generated a static Admin API token.

Required secrets:

- `SHOPIFY_STORE_DOMAIN=missing-people-2.myshopify.com`
- `SHOPIFY_ADMIN_ACCESS_TOKEN` or `SHOPIFY_ADMIN_TOKEN`
- `SHOPIFY_API_VERSION`
- `SHOPIFY_CASE_BLOG_HANDLE=missing-persons` or `SHOPIFY_CASE_BLOG_ID`

Required Admin API scopes:

- `read_content`
- `write_content`

Use `SHOPIFY_ADMIN_TOKEN` only if that is the existing secret name in the dashboard/control environment. The scanner treats it as equivalent to `SHOPIFY_ADMIN_ACCESS_TOKEN`.

## OAuth refresh-token mode

Shopify expiring offline access tokens can include an access token, expiry, and refresh token. If this mode is used, configure:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ACCESS_TOKEN`
- `SHOPIFY_ACCESS_TOKEN_EXPIRES_AT`
- `SHOPIFY_REFRESH_TOKEN` or `SHOPIFY_OFFLINE_REFRESH_TOKEN`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_CASE_BLOG_HANDLE` or `SHOPIFY_CASE_BLOG_ID`

The scanner can request a refreshed token before publishing. If Shopify returns a new refresh token, the new value must be persisted to a secure writable secret store. GitHub Actions environment variables are temporary and cannot preserve a rotated refresh token for the next run.

Until a secret persistence method is configured, prefer the static Admin API token for scheduled scanner publishing.

## Client-credentials mode

Use this mode when `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are available and Shopify accepts the client-credentials token request for this app.

Required secrets:

- `SHOPIFY_STORE_DOMAIN=missing-people-2.myshopify.com`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_API_VERSION`
- `SHOPIFY_CASE_BLOG_HANDLE=missing-persons` or `SHOPIFY_CASE_BLOG_ID`

The scanner requests a fresh access token before publishing. No token value is printed. If Shopify changes the grant settings or scopes, publishing will fail with a clear blocked/error status.

## Healthcheck

Run:

```sh
npm run scanner:health
```

The healthcheck reports:

- token mode
- whether an access token is present
- whether a refresh token is present
- whether client credentials are present
- whether the token is refreshable
- whether publishing is blocked

It does not print token values.
