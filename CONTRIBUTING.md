# Contributing to Serializr

Thank you for considering contributing to Serializr! Please follow these guidelines to ensure a smooth contribution process.

## Guidelines

1. **Create an Issue First**  
   Before creating a pull request (PR), please open an issue to discuss your proposed changes.

2. **Use Yarn**  
   This project uses `yarn` for dependency management. Please ensure you use `yarn` instead of `npm`.

3. **Include Unit Tests**  
   Any PR must include relevant unit tests to ensure the stability of the project.

4. **Lint Your Code**  
   Use `eslint` to check your code and resolve any suggestions or errors before submitting your PR. We suggest integrating `eslint` directly into your IDE for a seamless development experience.

5. **Format with Prettier**  
   Use `prettier` to ensure consistent code formatting across the project. We also recommend setting up `prettier` in your IDE to automatically format your code.

6. **Search Existing Issues**  
   Before opening a new issue, please search the existing issues to avoid duplicates.

## Setting up the environment

At the moment to setup your working environment you must do the following steps:

-   `yarn`
-   `yarn build`

Once this is done you will be able to run automated tests with

-   `yarn test`

**NOTE:** if you accidentally run `npm install` please revert any change it introduces. It is a known issue that running `npm install` corrupts the dependency tree

We appreciate your contributions and look forward to collaborating with you!
