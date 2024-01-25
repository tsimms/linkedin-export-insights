#!/bin/bash

curl --request POST \
  --header 'content-type: application/json' \
  'https://linkedinexportinsights-0umf--4000--ca1b5e18.local-credentialless.webcontainer.io/' \
  --data '{"query": "query { allActivities { ... on Message { id date from to content } ... on Connection { id date first_name last_name company } ... on Comment { id date link message } ... on Share { id date sharelink sharecommentary } ... on Reaction { id date reactionType link } ... on Vote { id date optiontext link } } }"}'
