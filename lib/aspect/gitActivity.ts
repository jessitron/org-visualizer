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

import {
    LocalProject,
} from "@atomist/automation-client";
import {
    Aspect,
    ExtractFingerprint,
    fingerprintOf,
    FP,
} from "@atomist/sdm-pack-fingerprint";
import * as child_process from "child_process";
import * as util from "util";
import {
    bandFor,
    Default,
} from "@atomist/sdm-pack-aspect/lib/util/bands";
import {
    AgeBands,
} from "@atomist/sdm-pack-aspect/lib/util/commonBands";

// atomist analyze github by query --cloneUnder $HOME/temp --poolSize 4 --update true --query "org:platformsh size:<500"

const exec = util.promisify(child_process.exec);

export const GitRecencyType = "git-recency";

export interface GitRecencyData {
    lastCommitTime: number;
}

const gitLastCommitCommand = "git log -1 --format=%cd --date=short";

const gitRecencyExtractor: ExtractFingerprint<GitRecencyData> =
    async clonedRepository => {
        const r = await exec(gitLastCommitCommand, { cwd: (clonedRepository as LocalProject).baseDir });
        if (!r.stdout) {
            return undefined;
        }
        const data = { lastCommitTime: new Date(r.stdout.trim()).getTime() };
        return fingerprintOf({
            type: GitRecencyType,
            data,
        });
    };


function lastDateToActivityBand(date: Date): string {
    const days = daysSince(date);
    return bandFor<AgeBands>({
        current: { upTo: 7 },
        recent: { upTo: 30 },
        ancient: { upTo: 365 },
        prehistoric: Default,
    }, days, { includeNumber: true });
}

/**
 * Classify since last commit
 */
export const GitRecency: Aspect<GitRecencyData> = {
    name: GitRecencyType,
    displayName: "Recency of git activity",
    baseOnly: true,
    extract: gitRecencyExtractor,
    toDisplayableFingerprintName: () => "Recency of git activity",
    toDisplayableFingerprint: fp => {
        const date = new Date(fp.data.lastCommitTime);
        return lastDateToActivityBand(date);
    },
    stats: {
        defaultStatStatus: {
            entropy: false,
        },
    },
};

const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds

function daysSince(date: Date): number {
    const now = new Date();
    return Math.round(Math.abs((now.getTime() - date.getTime()) / oneDay));
}