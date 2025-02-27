# Adaptyst Analyser: a tool for analysing performance analysis results
# Copyright (C) CERN. See LICENSE for details.

import subprocess
from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class JavaScriptSetupHook(BuildHookInterface):
    def initialize(self, version, build_data):
        subprocess.run('git submodule update --init', shell=True,
                       check=True)
        subprocess.run('./js_setup.sh', shell=True, check=True)
