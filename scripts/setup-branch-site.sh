#!/usr/bin/env bash
# One-time setup of a per-branch dev site: dev/<name> → https://vibe-dev-<name>.obfusco.us
# Same shape as big-diff/now: private S3 bucket, CloudFront with origin access control,
# the *.obfusco.us wildcard cert, Route 53 alias records. One shared IAM user
# (vibe-branch-deploy) gets deploy rights on every branch bucket set up here; its keys go
# into this repo's BRANCH_AWS_* secrets, which deploy.yml's deploy-branch job uses.
# Needs admin AWS creds (the local-deploy user can't do this). Safe to re-run.
#
#   AWS_PROFILE=<admin> bash scripts/setup-branch-site.sh chingy penrose
set -euo pipefail
export AWS_PAGER=""

[ $# -ge 1 ] || { echo "usage: $0 <branch-name-after-dev/> ..."; exit 1; }

ACCOUNT=531957616497
ZONE=Z2YGI1EJ2R4PG0                  # obfusco.us
CERT=arn:aws:acm:us-east-1:$ACCOUNT:certificate/f863af3a-c642-4712-9d09-ccf18d39b7a3  # *.obfusco.us
CACHE=658327ea-f89d-4fab-a63d-7e88639e58f6   # Managed-CachingOptimized
CF_ZONE=Z2FDTNDATAQYW2               # CloudFront's alias zone
USER=vibe-branch-deploy
REPO=nathanmoomaw/vibe
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

for NAME in "$@"; do
  B=vibe-dev-$NAME.obfusco.us
  echo "### $B"

  echo "== bucket"
  if ! aws s3api head-bucket --bucket "$B" >/dev/null 2>&1; then
    aws s3api create-bucket --bucket "$B" --region us-east-1 >/dev/null
  fi
  aws s3api put-public-access-block --bucket "$B" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  echo "== origin access control"
  OAC=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='$B'].Id | [0]" --output text)
  if [ "$OAC" = "None" ]; then
    OAC=$(aws cloudfront create-origin-access-control --origin-access-control-config \
      "Name=$B,Description=OAC for $B,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
      --query OriginAccessControl.Id --output text)
  fi

  echo "== distribution"
  DID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='$B'].Id | [0]" --output text)
  if [ "$DID" = "None" ]; then
    cat > "$TMP/dist.json" <<EOF
{
  "CallerReference": "vibe-dev-$NAME-$(date +%s)",
  "Aliases": {"Quantity": 1, "Items": ["$B"]},
  "DefaultRootObject": "index.html",
  "Origins": {"Quantity": 1, "Items": [{
    "Id": "s3-origin", "DomainName": "$B.s3.amazonaws.com", "OriginPath": "",
    "S3OriginConfig": {"OriginAccessIdentity": ""}, "OriginAccessControlId": "$OAC"}]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-origin", "ViewerProtocolPolicy": "redirect-to-https", "Compress": true,
    "CachePolicyId": "$CACHE",
    "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"], "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}}},
  "CustomErrorResponses": {"Quantity": 2, "Items": [
    {"ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0},
    {"ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0}]},
  "Comment": "vibe dev/$NAME", "Enabled": true, "PriceClass": "PriceClass_All", "HttpVersion": "http2", "IsIPV6Enabled": true,
  "ViewerCertificate": {"ACMCertificateArn": "$CERT", "SSLSupportMethod": "sni-only", "MinimumProtocolVersion": "TLSv1.2_2021"}
}
EOF
    DID=$(aws cloudfront create-distribution --distribution-config "file://$TMP/dist.json" --query Distribution.Id --output text)
  fi
  DDOM=$(aws cloudfront get-distribution --id "$DID" --query Distribution.DomainName --output text)
  echo "   $DID ($DDOM)"

  echo "== bucket policy (CloudFront only)"
  aws s3api put-bucket-policy --bucket "$B" --policy "$(cat <<EOF
{"Version": "2012-10-17", "Statement": [{"Sid": "AllowCloudFront", "Effect": "Allow",
  "Principal": {"Service": "cloudfront.amazonaws.com"}, "Action": "s3:GetObject", "Resource": "arn:aws:s3:::$B/*",
  "Condition": {"StringEquals": {"AWS:SourceArn": "arn:aws:cloudfront::$ACCOUNT:distribution/$DID"}}}]}
EOF
)"

  echo "== DNS"
  aws route53 change-resource-record-sets --hosted-zone-id $ZONE --change-batch "$(cat <<EOF
{"Changes": [
  {"Action": "UPSERT", "ResourceRecordSet": {"Name": "$B.", "Type": "A",
    "AliasTarget": {"HostedZoneId": "$CF_ZONE", "DNSName": "$DDOM.", "EvaluateTargetHealth": false}}},
  {"Action": "UPSERT", "ResourceRecordSet": {"Name": "$B.", "Type": "AAAA",
    "AliasTarget": {"HostedZoneId": "$CF_ZONE", "DNSName": "$DDOM.", "EvaluateTargetHealth": false}}}]}
EOF
)" >/dev/null
done

echo "### deploy user ($USER: every vibe-dev-*.obfusco.us bucket, invalidations, distribution lookup)"
aws iam get-user --user-name $USER >/dev/null 2>&1 || aws iam create-user --user-name $USER >/dev/null
aws iam put-user-policy --user-name $USER --policy-name deploy --policy-document "$(cat <<EOF
{"Version": "2012-10-17", "Statement": [
  {"Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::vibe-dev-*.obfusco.us"},
  {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::vibe-dev-*.obfusco.us/*"},
  {"Effect": "Allow", "Action": ["cloudfront:ListDistributions", "cloudfront:CreateInvalidation"], "Resource": "*"}]}
EOF
)"
if ! gh secret list -R $REPO | grep -q '^BRANCH_AWS_ACCESS_KEY_ID'; then
  read -r KEY SECRET < <(aws iam create-access-key --user-name $USER --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
  gh secret set BRANCH_AWS_ACCESS_KEY_ID -R $REPO --body "$KEY"
  gh secret set BRANCH_AWS_SECRET_ACCESS_KEY -R $REPO --body "$SECRET"
fi

echo "### first deploys"
for NAME in "$@"; do
  gh workflow run deploy.yml -R $REPO --ref "dev/$NAME"
  echo "   dev/$NAME → https://vibe-dev-$NAME.obfusco.us (CloudFront takes a few minutes the first time)"
done
