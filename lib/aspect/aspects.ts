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
    BranchCount,
    ChangelogAspect,
    CodeMetricsAspect,
    codeOfConduct,
    codeOwnership,
    ContributingAspect,
    ExposedSecrets,
    gitActiveCommitters,
    globAspect,
    license,
    LicensePresence,
} from "@atomist/sdm-pack-aspect";
import { buildTimeAspect } from "@atomist/sdm-pack-aspect/lib/aspect/delivery/BuildAspect";
import { LeinDeps } from "@atomist/sdm-pack-clojure";
import {
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    Aspect,
} from "@atomist/sdm-pack-fingerprint";
import {
    CiAspect,
    JavaBuild,
    StackAspect,
} from "./common/stackAspect";
import { K8sSpecs } from "./k8s/spec";
import { CsProjectTargetFrameworks } from "./microsoft/CsProjectTargetFrameworks";
import { NpmDependencies } from "./node/npmDependencies";
import { TypeScriptVersion } from "./node/TypeScriptVersion";
import * as commonCommitRiskScorers from "./push/commonCommitRiskScorers";
import {
    ConfirmedTags,
    suggestTag,
} from "./push/suggestTag";
import { PythonDependencies } from "./python/pythonDependencies";
import { DirectMavenDependencies } from "./spring/directMavenDependencies";
import { SpringBootStarter } from "./spring/springBootStarter";
import { SpringBootVersion } from "./spring/springBootVersion";
import { TravisScriptsAspect } from "./travis/travisAspects";
import { GitRecency } from "./gitActivity";

/**
 * The aspects managed by this SDM.
 * Modify this list to customize with your own aspects.
 */
export function aspects(): Aspect[] {
    return [
        DockerFrom,
        license(),
        NpmDependencies,
        codeOfConduct(),
        ExposedSecrets,
        BranchCount,
        GitRecency,
        StackAspect,
        CiAspect,
        ChangelogAspect,
        ContributingAspect,
        SpringBootVersion,
        DirectMavenDependencies,
        PythonDependencies,
        // Time builds
        buildTimeAspect(),
    ];
}
