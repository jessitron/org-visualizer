/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { LeinDeps } from "@atomist/sdm-pack-clojure/lib/fingerprints/clojure";
import { DockerFrom } from "@atomist/sdm-pack-docker";
import { NpmDeps } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import {
    CodeMetricsData,
    CodeMetricsType,
} from "../aspect/common/codeMetrics";
import { CiAspect } from "../aspect/common/stackAspect";
import { CodeOfConductType } from "../aspect/community/codeOfConduct";
import {
    hasNoLicense,
    isLicenseFingerprint,
} from "../aspect/community/license";
import { isFileMatchFingerprint } from "../aspect/compose/fileMatchAspect";
import { isGlobMatchFingerprint } from "../aspect/compose/globAspect";
import {
    CombinationTagger,
    Tagger,
} from "../aspect/DefaultAspectRegistry";
import { BranchCountType } from "../aspect/git/branchCount";
import { daysSince } from "../aspect/git/dateUtils";
import {
    GitActivesType,
    GitRecencyType,
} from "../aspect/git/gitActivity";
import { TsLintType } from "../aspect/node/TsLintAspect";
import { TypeScriptVersion } from "../aspect/node/TypeScriptVersion";
import { PythonDependencies } from "../aspect/python/pythonDependencies";
import { ExposedSecrets } from "../aspect/secret/exposedSecrets";
import { DirectMavenDependencies } from "../aspect/spring/directMavenDependencies";
import { SpringBootVersion } from "../aspect/spring/springBootVersion";
import { TravisScriptsAspect } from "../aspect/travis/travisAspects";

export interface TaggersParams {

    /**
     * Max number of branches not to call out
     */
    maxBranches: number;

    /**
     * Number of days at which to consider a repo dead
     */
    deadDays: number;
}

const DefaultTaggersParams: TaggersParams = {
    maxBranches: 20,
    deadDays: 365,
};

export function taggers(opts: Partial<TaggersParams>): Tagger[] {
    const optsToUse = {
        ...DefaultTaggersParams,
        ...opts,
    };
    return [
        {
            name: "vulnerable",
            description: "Has exposed secrets", test: fp => fp.type === ExposedSecrets.name,
            severity: "error",
        },
        { name: "docker", description: "Docker status", test: fp => fp.type === DockerFrom.name },
        { name: "node", description: "Node", test: fp => fp.type === NpmDeps.name },
        {
            name: "maven",
            description: "Direct Maven dependencies",
            test: fp => fp.type === DirectMavenDependencies.name,
        },
        { name: "typescript", description: "TypeScript version", test: fp => fp.type === TypeScriptVersion.name },
        { name: "tslint", description: "tslint (TypeScript)", test: fp => fp.type === TsLintType },
        { name: "clojure", description: "Lein dependencies", test: fp => fp.type === LeinDeps.name },
        { name: "spring-boot", description: "Spring Boot version", test: fp => fp.type === SpringBootVersion.name },
        { name: "travis", description: "Travis CI script", test: fp => fp.type === TravisScriptsAspect.name },
        { name: "python", description: "Python dependencies", test: fp => fp.type === PythonDependencies.name },
        {
            name: "monorepo",
            description: "Contains multiple virtual projects",
            severity: "warn",
            test: fp => !!fp.path && fp.path.length > 0,
        },
        {
            name: "jenkins",
            description: "Jenkins",
            test: fp => fp.type === CiAspect.name && fp.data.includes("jenkins"),
        },
        {
            name: "circleci",
            description: "circleci",
            test: fp => fp.type === CiAspect.name && fp.data.includes("circle"),
        },
        {
            name: "azure-pipelines",
            description: "Azure pipelines files",
            test: fp => isFileMatchFingerprint(fp) &&
                fp.name.includes("azure-pipeline") && fp.data.matches.length > 0,
        },
        {
            name: "snyk",
            description: "Snyk policy",
            test: fp => isFileMatchFingerprint(fp) &&
                fp.data.glob.includes("snyk") && fp.data.matches.length > 0,
        },
        {
            // TODO allow to use #
            name: "CSharp",
            description: "C# build",
            test: fp => isFileMatchFingerprint(fp) &&
                fp.name.includes("csproj") && fp.data.matches.length > 0,
        },
        {
            name: "solo",
            description: "Projects with one committer",
            test: fp => fp.type === GitActivesType && fp.data.count === 1,
        },
        {
            name: `>${optsToUse.maxBranches} branches`,
            description: "git branch count",
            severity: "warn",
            test: fp => fp.type === BranchCountType && fp.data.count > optsToUse.maxBranches,
        },
        {
            name: "huge (>10K)",
            description: "Repo size",
            test: fp => fp.type === CodeMetricsType && (fp.data as CodeMetricsData).lines > 10000,
        },
        {
            name: "big (3-10K)",
            description: "Repo size",
            test: fp => fp.type === CodeMetricsType && (fp.data as CodeMetricsData).lines > 3000 && (fp.data as CodeMetricsData).lines < 10000,
        },
        {
            name: "code-of-conduct",
            description: "Repositories should have a code of conduct",
            test: fp => fp.type === CodeOfConductType,
        },
        {
            name: "changelog",
            description: "Repositories should have a changelog",
            test: fp => isGlobMatchFingerprint(fp) && fp.data.glob === "CHANGELOG.md",
        },
        {
            name: "contributing",
            description: "Repositories should have a contributing",
            test: fp => isGlobMatchFingerprint(fp) && fp.data.glob === "CONTRIBUTING.md",
        },
        {
            name: "license",
            description: "Repositories should have a license",
            test: fp => isLicenseFingerprint(fp) && !hasNoLicense(fp.data),
        },
        {
            name: "dead?",
            description: `No git activity in last ${optsToUse.deadDays} days`,
            severity: "error",
            test: fp => {
                if (fp.type === GitRecencyType) {
                    const date = new Date(fp.data);
                    return daysSince(date) > optsToUse.deadDays;
                }
                return false;
            },
        },
    ];
}

export interface CombinationTaggersParams {

    /**
     * Mininum percentage of average aspect count (fraction) to expect to indicate adequate project understanding
     */
    minAverageAspectCountFractionToExpect: number;

    /**
     * Days since the last commit to indicate a hot repo
     */
    hotDays: number;

    /**
     * Number of committers needed to indicate a hot repo
     */
    hotContributors: number;
}

// TODO can reduce days with non stale data
const DefaultCombinationTaggersParams: CombinationTaggersParams = {
    minAverageAspectCountFractionToExpect: .75,
    hotDays: 10,
    hotContributors: 2,
};

export function combinationTaggers(opts: Partial<CombinationTaggersParams>): CombinationTagger[] {
    const optsToUse = {
        ...DefaultCombinationTaggersParams,
        ...opts,
    };
    return [
        {
            name: "not understood",
            description: "You may want to write aspects for these outlier projects",
            severity: "warn",
            test: (fps, tagContext) => {
                const aspectCount = _.uniq(fps.map(f => f.type)).length;
                // There are quite a few aspects that are found on everything, e.g. git
                // We need to set the threshold count probably
                return aspectCount < tagContext.averageFingerprintCount * optsToUse.minAverageAspectCountFractionToExpect;
            },
        },
        {
            name: "not understood",
            description: "You may want to write aspects for these outlier projects",
            severity: "warn",
            test: (fps, tagContext) => {
                const aspectCount = _.uniq(fps.map(f => f.type)).length;
                // There are quite a few aspects that are found on everything, e.g. git
                // We need to set the threshold count probably
                return aspectCount < tagContext.averageFingerprintCount * optsToUse.minAverageAspectCountFractionToExpect;
            },
        },
        {
            name: "hot",
            description: "How hot is git",
            test: fps => {
                const grt = fps.find(fp => fp.type === GitRecencyType);
                const acc = fps.find(fp => fp.type === GitActivesType);
                if (!!grt && !!acc) {
                    const days = daysSince(new Date(grt.data));
                    if (days < optsToUse.hotDays && acc.data.count > optsToUse.hotContributors) {
                        return true;
                    }
                }
                return false;
            },
        },
    ];
}