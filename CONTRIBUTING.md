# Introduction
Interested in contributing to ApostropheCMS? That’s fantastic! We really appreciate your interest and value your time. Because of that fact, we’ve drafted some guidelines to make the most of your contributions, and helps maintain ApostropheCMS as the best Node CMS in the universe.

# Community
There is a growing community of users on [Gitter](https://gitter.im/apostrophecms/apostrophe), and you can post and find answers to support questions about ApostropheCMS in [StackOverflow](https://stackoverflow.com/questions/tagged/apostrophe-cms) where fellow ApostropheCMS users are happy to help you out.

We hold regular meetups at our office in Philadelphia which are broadcasted on our [Twitch channel](https://www.twitch.tv/apostrophecms). This is a great opportunity to check-in with the Apostrophe team, say “Hi” and hear about what we are working on.

# Code of Conduct

In the interest of fostering an open and welcoming environment, we as
contributors and maintainers pledge to making participation in our project and
our community a harassment-free experience for everyone, regardless of age, body
size, disability, ethnicity, sex characteristics, gender identity and expression,
level of experience, education, socio-economic status, nationality, personal
appearance, race, religion, or sexual identity and orientation. All contributors are expected to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

# Contributions Made Easy
One way to contribute to ApostropheCMS is by expanding the existing documentation. The docs repo is here: https://github.com/apostrophecms/apostrophe-documentation. Pull requests that update and refine this information are super useful.

Along those lines, the authoring of blog posts about your experiences using ApostropheCMS or tweets expressing your interest help spread the word. When you launch a site on ApostropheCMS, ping us in Gitter or on Twitter. We love a good success story.

Of course, we welcome traditional open source contributions via pull requests and new open issues to our GitHub repository. If you’d like to dig in right away see issues with the [“contributions welcome” label](https://github.com/apostrophecms/apostrophe/issues?q=is%3Aopen+is%3Aissue+label%3A%22contributions+welcome%22).

Detailed information about submitting code contributions and new issues to our GitHub repository are documented below.

# Reporting a Bug
If you come across a bug, please submit an issue in the GitHub repo. That’s the primary source for bug documentation, so first be sure to search the existing issues and make sure it hasn’t been logged. If it hasn’t, please include the following details as they apply:

1. Steps to reproduce the bug.
2. The expected behavior and actual behavior.
3. Screenshots or animated .GIFs to help illustrate the behavior.
4. Code samples.

Finally, remember to attach the “Bug” label to the issue, to help use stay organized.

Bonus: Although not required, if you write a test that reproduces the bug you found, and submit that failing test as a PR… well, we might even send you some swag 😉.

# Suggesting a Feature or Enhancement 
We also track feature requests and larger scale enhancements within the GitHub repository. After a search of existing issues to confirm your idea is unique, please feel free to submit your idea as a new issue. Remember to include details that articulate the current functionality and how this enhancement will improve or build upon that. Attaching images to illustrate your feature is often useful.

Adding the label of “enhancement” along with categorizing your issue with an existing label such as UI, UX, Accessibility, Security, etc. will help the team stay organized and is greatly appreciated.

# Fixing Bugs or Submitting Enhancements
If you’ve perused our open issues labeled “Bug” and decide to work to resolve one, or you’ve got a new feature that you’d like to commit to the core project, please keep these things in mind:

1. Make sure your pull request includes tests. [For examples of back-end unit tests, look here](
https://github.com/apostrophecms/apostrophe/tree/master/test) at the test folder of the apostrophe module. This level of coverage is expected for backend features that aren't already covered by a test. [For examples of front-end, browser-based regression tests, checkout the apostrophe-enterprise-testbed module](https://github.com/apostrophecms/apostrophe-enterprise-testbed). We don't expect that every contributor is ready to write Nightwatch tests like these, but it is surely appreciated. If it’s a bug fix you should have a test that reproduces the issue (if you can’t write a test for the bug you are addressing, please note the reason why).
2. Run ESLint to be sure your update adheres to our coding standards. The `apostrophe` module already has a `.eslintrc` file, so the simplest way is to run: `npx eslint .` Your editor may automatically point out eslint-detected concerns as well.
3. Enhancements should include documentation and include implementation details were applicable.

# Should you make a new npm module?

Great question. If it's not a bug fix or an improvement to the core UI, it often doesn't belong in the core `apostrophe` npm module. For instance, our blogging functionality is in the separate `apostrophe-blog` npm module.

See [publishing your own npm modules for Apostrophe](https://apostrophecms.org/docs/more-modules.html#publishing-your-own-npm-modules-for-apostrophe) for more information.

