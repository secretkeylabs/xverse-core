#! /bin/bash

##
# merge-to-remote.sh
#
# to be run locally from downstream repo, or from GitHub Actions

set -e

if [[ -z $(git status --porcelain) ]]; then
  echo "Working directory clean. Proceeding with merge."
else
  echo "Working directory not clean. Please commit or stash your changes before proceeding."
  exit 1
fi

ORIGIN_BRANCH=${ORIGIN_BRANCH:-develop} # defaults to develop
REMOTE_REPO=${REMOTE_REPO:-xverse-core} # defaults to xverse-core

echo "Merging $ORIGIN_BRANCH to $REMOTE_REPO"

ORIGIN_NAME="origin"
REMOTE_URL="git@github.com:secretkeylabs/$REMOTE_REPO.git"
if [[ $GITHUB_ACTIONS == "true" ]]; then
  echo "Running in GitHub Actions. Using GitHub token for authentication."
  REMOTE_URL="https://${GH_TOKEN}@github.com/secretkeylabs/$REMOTE_REPO"
fi
REMOTE_NAME="public"


## add or set remote
git remote | grep -w $REMOTE_NAME || git remote add $REMOTE_NAME $REMOTE_URL
git remote set-url $REMOTE_NAME $REMOTE_URL
git remote set-url --push $REMOTE_NAME $REMOTE_URL
git remote -v

## fetch from all remotes including tags
git fetch $ORIGIN_NAME $ORIGIN_BRANCH --tags
git fetch $REMOTE_NAME $ORIGIN_BRANCH --tags

PR_TITLE="merge-$ORIGIN_BRANCH-to-$REMOTE_NAME"
REMOTE_BRANCH="chore/$PR_TITLE-$(date +%s)"
REMOTE_BASE=$ORIGIN_BRANCH

## checkout origin branch and push to remote
echo "Checking out $ORIGIN_NAME/$ORIGIN_BRANCH and pushing to $REMOTE_NAME/$REMOTE_BRANCH"
git checkout $ORIGIN_NAME/$ORIGIN_BRANCH
git checkout -B $REMOTE_BRANCH
git push -v $REMOTE_NAME $REMOTE_BRANCH

if command -v gh >/dev/null 2>&1; then
  echo "gh cli installed. Proceeding with PR creation."
else
  echo "gh cli not installed. Please install gh cli or create the PR manually."
  exit 1
fi

## create PR
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/{owner}/$REMOTE_REPO/pulls \
  -f title="$PR_TITLE" \
  -f head="$REMOTE_BRANCH" \
  -f base="$REMOTE_BASE" \
  -f body="Created by merge-to-remote.sh" > pr.json

## push tags
git push $REMOTE_NAME --tags
