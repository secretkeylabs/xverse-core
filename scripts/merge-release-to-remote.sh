#! /bin/bash

##
# merge-release-to-remote.sh
#
# to be run locally from downstream repo

set -e
set -x

if [[ -z $(git status --porcelain) ]]; then
  echo "Working directory clean. Proceeding with merge."
else
  echo "Working directory not clean. Please commit or stash your changes before proceeding."
  exit 1
fi

ORIGIN_BRANCH=${ORIGIN_BRANCH:-main} # defaults to main
REMOTE_REPO=${REMOTE_REPO:-xverse-core} # defaults to xverse-core
SYNC_NUMBER=${SYNC_NUMBER:-30} # defaults to 1

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

## sync releases
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  '/repos/{owner}/xverse-core-private/releases?per_page=100' > releases.json

LENGTH=$(jq '. | length' releases.json)

for i in $(seq 0 $((LENGTH-1))); do
  if ((i >= SYNC_NUMBER)); then
    break
  fi
  RELEASE_ID=$(jq -r ".[$i].id" releases.json)
  RELEASE_NAME=$(jq -r ".[$i].name" releases.json)
  RELEASE_TAG=$(jq -r ".[$i].tag_name" releases.json)
  # RELEASE_TARGET_COMMITISH=$(jq -r ".[$i].target_commitish" releases.json)
  RELEASE_BODY=$(jq -r ".[$i].body" releases.json)
  RELEASE_DRAFT=$(jq -r ".[$i].draft" releases.json)
  RELEASE_PRERELEASE=$(jq -r ".[$i].prerelease" releases.json)
  RELEASE_ASSET_ID=$(jq -r ".[$i].assets[0].id" releases.json)
  RELEASE_ASSET_NAME=$(jq -r ".[$i].assets[0].name" releases.json)
  if ((i == 0)); then
    RELEASE_LATEST="true"
  else
    RELEASE_LATEST="false"
  fi

  if [[ $RELEASE_DRAFT == "true" ]]; then
    echo "Release $RELEASE_NAME is a draft. Skipping."
    continue
  fi

  if [[ $RELEASE_PRERELEASE == "true" ]]; then
    echo "Release $RELEASE_NAME is a prerelease. Skipping."
    continue
  fi

  echo "Syncing release $RELEASE_NAME"

  echo "Finding release $RELEASE_TAG in $REMOTE_REPO"
  REMOTE_RELEASE_ID=$(gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    /repos/{owner}/$REMOTE_REPO/releases/tags/$RELEASE_TAG | jq -r ".id")

  echo $REMOTE_RELEASE_ID

  if [[ -z $REMOTE_RELEASE_ID || "$REMOTE_RELEASE_ID" == "null" ]]; then
    echo "Release $RELEASE_TAG not found in $REMOTE_REPO."
  else
    echo "Release $RELEASE_TAG found in $REMOTE_REPO. Deleting release $REMOTE_RELEASE_ID first."
    gh api \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      -X DELETE \
      /repos/{owner}/$REMOTE_REPO/releases/$REMOTE_RELEASE_ID > /dev/null
  fi

  echo "Creating release $RELEASE_TAG"
  gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -X POST \
    -F "tag_name=$RELEASE_TAG" \
    -F "name=$RELEASE_NAME" \
    -F "body=$RELEASE_BODY" \
    -f "make_latest=$RELEASE_LATEST" \
    /repos/{owner}/$REMOTE_REPO/releases | jq -r ".id"
done

# sync release assets
# for i in $(seq 0 $((LENGTH-1))); do
#   if ((i >= SYNC_NUMBER)); then
#     break
#   fi
#
#   RELEASE_NAME=$(jq -r ".[$i].name" releases.json)
#   RELEASE_TAG=$(jq -r ".[$i].tag_name" releases.json)
#   RELEASE_DRAFT=$(jq -r ".[$i].draft" releases.json)
#   RELEASE_PRERELEASE=$(jq -r ".[$i].prerelease" releases.json)
#   RELEASE_ASSET_ID=$(jq -r ".[$i].assets[0].id" releases.json)
#   RELEASE_ASSET_NAME=$(jq -r ".[$i].assets[0].name" releases.json)
#
#   if [[ $RELEASE_DRAFT == "true" ]]; then
#     echo "Release $RELEASE_NAME is a draft. Skipping."
#     continue
#   fi
#
#   if [[ $RELEASE_PRERELEASE == "true" ]]; then
#     echo "Release $RELEASE_NAME is a prerelease. Skipping."
#     continue
#   fi
#
#   REMOTE_RELEASE_ID=$(gh api \
#     -H "Accept: application/vnd.github+json" \
#     -H "X-GitHub-Api-Version: 2022-11-28" \
#     /repos/{owner}/$REMOTE_REPO/releases/tags/$RELEASE_TAG | jq -r ".id")
#
#   echo "Downloading release asset $RELEASE_ASSET_NAME"
#   # brew install coreutils to use gtimeout. needed when sometimes gh release download hangs
#   gtimeout 20 gh release download $RELEASE_TAG --clobber || true
#
#   echo "Uploading release asset $RELEASE_ASSET_NAME to release $REMOTE_RELEASE_ID"
#   gh release upload $RELEASE_TAG $RELEASE_ASSET_NAME --repo secretkeylabs/$REMOTE_REPO --clobber
#
#   rm $RELEASE_ASSET_NAME;
# done
