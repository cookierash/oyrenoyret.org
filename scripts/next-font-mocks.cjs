/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');

const fontPath = path.join(__dirname, 'next-font-mock.woff2');

const makeCss = (family) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 400;
  src: url(${fontPath}) format('woff2');
}
`;

module.exports = {
  'https://fonts.googleapis.com/css2?family=Comfortaa:wght@300..700&display=swap': makeCss(
    'Comfortaa'
  ),
  'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap': makeCss(
    'Inter'
  ),
};
