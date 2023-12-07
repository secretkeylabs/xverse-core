#! /bin/bash

##
# create-release-pr.sh for xverse-core
#
# NOTE: make sure you git commit your work before running this.
# Alternatively trigger it from the github action
#

if [[ -z "$BUMP" ]]; then
  echo "BUMP is required. major|minor|patch"
  exit 1
fi

# only need to merge to develop for this repo
b=develop

echo -e "\n--- Prepare for $BUMP release branch ---"

git fetch --all
git checkout develop
git pull

npm version $BUMP --git-tag-version=false
VERSION=$(npm pkg get version | sed 's/"//g')
TAG="v$VERSION"
BRANCH="release/$TAG"
TITLE="release: $TAG"

git checkout -B $BRANCH
git commit -am "$TITLE"
# git merge origin/main -s ours

git push --set-upstream origin $BRANCH

echo -e "\n--- Create draft release for $TAG ---"

gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/{owner}/{repo}/releases \
  -f tag_name=$TAG \
  -f target_commitish="$BRANCH" \
  -f name=$TAG \
  -F draft=true \
  -F prerelease=true \
  -F generate_release_notes=true > release.json

cat release.json | jq -r .body > body.md
echo -e "\n\nDraft release: $(cat release.json | jq -r .html_url)" >> body.md

echo -e "\n--- Create PR to $b ---"

gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/{owner}/{repo}/pulls \
  -f title="$TITLE to $b" \
  -f body="Created by GitHub Actions Bot" \
  -f head="$BRANCH" \
  -f base="$b" > pr-$b.json

echo -e "\n--- Update PR to $b with description ---"

PR_ID=$(cat pr-$b.json | jq -r .number)
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/{owner}/{repo}/pulls/$PR_ID \
  -F 'body=@body.md'

echo -e "\n--- Update PR to $b with label ---"

RELEASE_ID=$(cat release.json | jq -r .id)
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/{owner}/{repo}/issues/$PR_ID/labels \
  -f "labels[]=RID_$RELEASE_ID"

# clean up temp files
# rm pr-$b.json

echo -e "\n--- Done ---"
# clean up temp files
# rm release.json
# rm body.md
