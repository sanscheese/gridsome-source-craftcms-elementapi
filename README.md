# Craft CMS source for Gridsome

> This package is under development and API might change before v1 is released.

## Install

- `yarn add @bhws/gridsome-source-craftcms-elementapi`
- **OR** `npm install @bhws/gridsome-source-craftcms-elementapi`

## Usage

```js
module.exports = {
  plugins: [
    {
      use: '@bhws/gridsome-source-craftcms-elementapi',
      options: {
        baseUrl: 'WEBSITE_URL', // required
        apiBase: 'api/1.0/gridsome',
        typeNamePrefix: 'craft',
        concurrent: 10
      }
    }
  ],
}
```
