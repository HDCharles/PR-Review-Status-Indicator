# PR-Review-Status-Indicator
A Tampermonkey script that adds an indicator for review status in the PR review notification screen.

<img width="2121" height="907" alt="image" src="https://github.com/user-attachments/assets/fec78806-c394-4af0-aca7-6339baab7e55" />

Can be configured to add the indicator everywhere, just in notifications or just in review-requested page.
Can be configured to be just the icon, icon+text or icon+text+color/pill

# Installation

1) Put the [Tampermonkey](https://www.tampermonkey.net/) on your browser and then add a new script, copy-paste the [script](https://raw.githubusercontent.com/HDCharles/gh-pr-quick-update/refs/heads/main/gh-pr-quick-update.js) in and then save
2) the github API will rate limit you at 60 requests per hour without an api token. To add one:
 a) go to github.com > settings > developer settings > personal access tokens > fine-grained tokens 
 b) either click public repositories (no additional permission) or all-repositories + pull-request permissions
 c) copy the PAT
3) you can click on tamper monkey and add your github username and PAT

