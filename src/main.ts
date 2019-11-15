import * as core from '@actions/core';
import github from '@actions/github';

const APPROVED = "APPROVED";
const DEFECT = "CHANGES_REQUESTED"

async function run() {
  let approvals = 0;
  let defects = 0;
  let awaitingResponse = 0;

  const REQUIRED_APPROVALS = Number(core.getInput('APPROVALS'));
  const ALLOWABLE_DEFECTS = Number(core.getInput('DEFECTS'));
  const LABEL = core.getInput('LABEL');

  // This should be a token with access to your repository scoped in as a secret.
  // The YML workflow will need to set github_token with the GitHub Secret Token
  // github_token: ${{ secrets.GITHUB_TOKEN }}
  // https://help.github.com/en/articles/virtual-environments-for-github-actions#github_token-secret
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const octokit = new github.GitHub(GITHUB_TOKEN);

  const PR_CONFIG = {
    ...github.context.repo,
    number: github.context.issue.number,
  }

  const LABEL_CONFIG = {
    ...PR_CONFIG,
    labels: [ LABEL ],
  }

  const { data: reviews } = await octokit.pulls.listReviews(PR_CONFIG);
  const { data: pr } = await octokit.pulls.get(PR_CONFIG);

  const reviewerMap = pr.requested_reviewers.reduce(
    (obj, user) => ({ ...obj, [user.login]: null}),
    {}
  );

  reviews.forEach(({ state, user: { login } }) => reviewerMap[login] = state)

  for (const login in reviewerMap) {
    const { state } = reviewerMap[login];
    if (!state) {
      awaitingResponse++
      core.info(`A requested reviewer (${login}) has not responded yet`);
    }
    if (state === APPROVED) {
      approvals++;
      core.info(`Approved by ${login}`)
    }
    if (state === DEFECT) {
      defects++;
      core.info(`Changes requested by ${login}`)
    }
  }

  if (defects > ALLOWABLE_DEFECTS) {
    const { status } = await octokit.issues.removeLabels(LABEL_CONFIG)
    if (status < 300) {
      return core.info(`removed ${LABEL_CONFIG.labels} from ${pr.title}`)
    }
    return core.info(`attempting to remove labels from the pr returned a ${status} code`)
  }
  if (
    approvals >= REQUIRED_APPROVALS
    && !awaitingResponse
    // && pr.mergeable   - SHOULD CHECK FOR MERGEABLE??
  ) {
    const { status } = await octokit.issues.addLabels(LABEL_CONFIG)
    if (status < 300) {
      return core.info(`removed ${LABEL_CONFIG.labels} from ${pr.title}`)
    }
    return core.info(`attempting to remove labels from the pr returned a ${status} code`)
  }
  return core.info('No actions were executed');
}

run();
