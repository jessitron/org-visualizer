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

import { Configuration, logger, TokenCredentials, buttonForCommand } from "@atomist/automation-client";

import * as Octokit from "@octokit/rest";
import {
    anySatisfied,
    metadata,
    PushImpact,
    ToDefaultBranch,
} from "@atomist/sdm";
import {
    configure,
    DeliveryGoals,
    isInLocalMode,
} from "@atomist/sdm-core";
import * as slack from "@atomist/slack-messages";
import {
    aspectSupport,
    DefaultVirtualProjectFinder,
} from "@atomist/sdm-pack-aspect";
import { sdmConfigClientFactory } from "@atomist/sdm-pack-aspect/lib/analysis/offline/persist/pgClientFactory";
import { PostgresProjectAnalysisResultStore } from "@atomist/sdm-pack-aspect/lib/analysis/offline/persist/PostgresProjectAnalysisResultStore";
import {
    storeFingerprints,
    storeFingerprintsFor,
} from "@atomist/sdm-pack-aspect/lib/aspect/delivery/storeFingerprintsPublisher";
import { Build } from "@atomist/sdm-pack-build";
import { VirtualProjectFinder } from "@atomist/sdm-pack-fingerprint";
import {
    IsMaven,
    mavenBuilder,
    MavenDefaultOptions,
} from "@atomist/sdm-pack-spring";
import { aspects } from "./lib/aspect/aspects";
import * as commonCommitRiskScorers from "./lib/aspect/push/commonCommitRiskScorers";
import { scorers } from "./lib/scorer/scorers";
import {
    combinationTaggers,
    taggers,
} from "./lib/tagger/taggers";
import { startEmbeddedPostgres } from "./lib/util/postgres";
import { queryByCriteria } from "@atomist/sdm-pack-aspect/lib/analysis/offline/spider/github/GitHubSpider"

const virtualProjectFinder: VirtualProjectFinder = DefaultVirtualProjectFinder;

interface TestGoals extends DeliveryGoals {
    build: Build;
    pushImpact: PushImpact;
}

export const configuration: Configuration = configure<TestGoals>(async sdm => {

    // Create goals that compute fingerprints during delivery
    const pushImpact = new PushImpact();

    const build: Build = new Build()
        .with({
            ...MavenDefaultOptions,
            builder: mavenBuilder(),
        });

    const store = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory(sdm.configuration));


    sdm.addCommand<{ owner: string }>({
        name: "RemoveTestRepos",
        intent: "clean up test repos",
        autoSubmit: true,
        parameters: {
            owner: { description: "github organization" },
        },
        listener: async ci => {
            let count = 0;
            const owner = ci.parameters.owner;
            const githubQuery = `org:${owner} test-repo`;
            await ci.addressChannels(`Searching GitHub for repositories that match: ${githubQuery}`)
            for await (const r of queryByCriteria((ci.credentials as TokenCredentials).token, {
                githubQueries: [githubQuery], maxRetrieved: 100, maxReturned: 100,
            })) {
                const repo = r.name;
                count++;
                await ci.addressChannels({
                    attachments: [
                        {
                            text: `Found: ${githubUrl(owner, repo)}`,
                            fallback: "yo",
                            actions: [
                                buttonForCommand({
                                    text: "Delete", style: "danger",
                                }, "DeleteRepo", { owner, repo })
                            ]
                        }
                    ]
                });
            }
            await ci.addressChannels(`Total of ${count} test repos found in ${owner}`);
        }
    });

    sdm.addCommand<{ owner: string, repo: string }>({
        name: "DeleteRepo",
        intent: "delete repository",
        parameters: {
            owner: { description: "github organization" },
            repo: { description: "name of repository" }
        },
        listener: async ci => {
            const token = (ci.credentials as TokenCredentials).token;
            const { owner, repo } = ci.parameters;
            await ci.addressChannels({
                text: `Deleting: ${githubUrl(owner, repo)}`,
            })
            const octokit = new Octokit({
                auth: token ? "token " + token : undefined,
                baseUrl: "https://api.github.com",
            });

            try {

                const r = await octokit.repos.delete({ owner, repo });
                logger.warn("Result: " + JSON.stringify(r, null, 2));
                await ci.addressChannels("Deletion complete :oh-yeaahh:");
            } catch (e) {
                logger.error((e as Error).stack);
                await ci.addressChannels("It didn't work :boo:");
            }
        }
    })

    sdm.addExtensionPacks(
        aspectSupport({
            aspects: aspects(),

            scorers: {
                all: scorers(),
                commitRisk: [
                    commonCommitRiskScorers.fileChangeCount({ limitTo: 2 }),
                    commonCommitRiskScorers.pomChanged(),
                ],
            },

            taggers: taggers({}).concat(combinationTaggers({})),

            goals: {
                // This enables fingerprints to be computed on push
                pushImpact,

                // This enables demonstrating a build aspect
                build,
            },

            virtualProjectFinder,

            // In local mode, publish fingerprints to the local PostgreSQL
            // instance, not the Atomist service
            publishFingerprints:
                isInLocalMode() ? storeFingerprints(store) : undefined,
            instanceMetadata: metadata(),
        }),
    );

    // Return the goals that this SDM will calculate in response to events
    // Add your goals. See the Atomist samples organization at
    // https://github.com/atomist/samples
    return {
        // Fingerprint every push to default branch
        fingerprint: {
            test: ToDefaultBranch,
            goals: pushImpact,
        },
        // We know how to build Maven projects
        build: {
            test: anySatisfied(IsMaven),
            goals: build,
        },
    };
},
    {
        name: "Org Visualizer",
        preProcessors: [startEmbeddedPostgres],
    });

function githubUrl(owner: string, repo: string) {
    return slack.url(`https://github.com/${owner}/${repo}`, `${owner}/${repo}`)
}