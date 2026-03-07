import nextConfig from "eslint-config-next";
import reactCompiler from "eslint-plugin-react-compiler";

const eslintConfig = [
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
  ...nextConfig,
];

export default eslintConfig;
