"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const APPROVED = "APPROVED";
const DEFECT = "CHANGES_REQUESTED";
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        let approvals = 0;
        let defects = 0;
        let awaitingResponse = 0;
        const REQUIRED_APPROVALS = Number(core.getInput('APPROVALS'));
        const ALLOWABLE_DEFECTS = Number(core.getInput('DEFECTS'));
        const LABEL = core.getInput('LABEL');
        core.info(`${REQUIRED_APPROVALS} ${ALLOWABLE_DEFECTS} ${LABEL}`);
        // This should be a token with access to your repository scoped in as a secret.
        // The YML workflow will need to set github_token with the GitHub Secret Token
        // github_token: ${{ secrets.GITHUB_TOKEN }}
        // https://help.github.com/en/articles/virtual-environments-for-github-actions#github_token-secret
        const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
        const octokit = new github.GitHub(GITHUB_TOKEN);
        const PR_NUMBER = github.context.issue.number;
        const PR_CONFIG = Object.assign(Object.assign({}, github.context.repo), { pull_number: PR_NUMBER });
        const LABEL_CONFIG = Object.assign(Object.assign({}, github.context.repo), { number: PR_NUMBER, labels: [LABEL] });
        const { data: reviews } = yield octokit.pulls.listReviews(PR_CONFIG);
        const { data: pr } = yield octokit.pulls.get(PR_CONFIG);
        const reviewerMap = pr.requested_reviewers.reduce((obj, user) => (Object.assign(Object.assign({}, obj), { [user.login]: null })), {});
        reviews.forEach(({ state, user: { login } }) => reviewerMap[login] = state);
        for (const login in reviewerMap) {
            const { state } = reviewerMap[login];
            if (!state) {
                awaitingResponse++;
                core.info(`A requested reviewer (${login}) has not responded yet`);
            }
            if (state === APPROVED) {
                approvals++;
                core.info(`Approved by ${login}`);
            }
            if (state === DEFECT) {
                defects++;
                core.info(`Changes requested by ${login}`);
            }
        }
        if (defects > ALLOWABLE_DEFECTS) {
            const { status } = yield octokit.issues.removeLabels(LABEL_CONFIG);
            if (status < 300) {
                return core.info(`removed ${LABEL_CONFIG.labels} from ${pr.title}`);
            }
            return core.info(`attempting to remove labels from the pr returned a ${status} code`);
        }
        if (approvals >= REQUIRED_APPROVALS
            && !awaitingResponse
        // && pr.mergeable   - SHOULD CHECK FOR MERGEABLE??
        ) {
            const { status } = yield octokit.issues.addLabels(LABEL_CONFIG);
            if (status < 300) {
                return core.info(`removed ${LABEL_CONFIG.labels} from ${pr.title}`);
            }
            return core.info(`attempting to remove labels from the pr returned a ${status} code`);
        }
        return core.info('No actions were executed');
    });
}
run();
