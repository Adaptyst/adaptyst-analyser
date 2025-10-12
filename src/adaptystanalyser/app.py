# SPDX-FileCopyrightText: 2025 CERN
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-PackageName: Adaptyst Analyser: a tool for analysing performance analysis results

import traceback
import yaml
import json
from flask import Flask, render_template, request
from pathlib import Path
from . import PerformanceAnalysisResults
from importlib.metadata import version
from importlib import import_module


app = Flask(__name__)
app.config.from_prefixed_env()


if 'PERFORMANCE_ANALYSIS_STORAGE' not in app.config:
    raise RuntimeError('Please set FLASK_PERFORMANCE_ANALYSIS_STORAGE environment '
                       'variable to the absolute path to a directory where '
                       'Adaptyst performance analysis results are stored.')


static_path = Path(app.root_path) / 'static'
scripts = ['jquery.min.js'] + \
    list(sorted(filter(lambda x: x != 'jquery.min.js',
                       map(lambda x: x.name,
                           static_path.glob('*.js'))))) + \
    list(sorted(map(lambda x: 'deps/' + x.name,
                    static_path.glob('deps/*.js')))) + \
    list(sorted(map(lambda x: 'deps/' + x.name,
                    static_path.glob('deps/*.cjs'))))
stylesheets = list(sorted(map(lambda x: x.name,
                              static_path.glob('*.css')))) + \
    list(sorted(map(lambda x: 'modules/' + x.parent.name + '/settings.css',
                    static_path.glob('modules/*/settings.css')))) + \
    list(sorted(map(lambda x: 'deps/' + x.name,
                    static_path.glob('deps/*.css'))))

backends = []

for p in static_path.glob('modules/*/settings.html'):
    backend = {}
    backend['name'] = p.parent.name
    backend['settings_code'] = p.read_text()
    backends.append(backend)

min_mod_vers = {}

for p in Path(app.root_path).glob('modules/*/metadata.yml'):
    mod_id = p.parent.name
    with p.open(mode='r') as f:
        metadata = yaml.safe_load(f)
    min_mod_vers[mod_id] = metadata.get('min_module_version', [])


@app.get('/<identifier>/')
def get(identifier):
    try:
        results = PerformanceAnalysisResults(
            app.config['PERFORMANCE_ANALYSIS_STORAGE'],
            identifier)
        return results.get_system_graph()
    except ValueError:
        return '', 404


@app.post('/<identifier>/<entity>/<node>/<module>')
def post(identifier, entity, node, module):
    try:
        try:
            backend = import_module(f'adaptystanalyser.modules.{module}')
        except ModuleNotFoundError:
            traceback.print_exc()
            return '', 404

        return backend.process(app.config['PERFORMANCE_ANALYSIS_STORAGE'],
                               identifier, entity, node, request.values)
    except ValueError:
        traceback.print_exc()
        return '', 404
    except ImportError:
        traceback.print_exc()
        return '', 500


@app.route('/')
def main():
    if len(app.config.get('CUSTOM_TITLE')) > 0:
        title = 'Adaptyst Analyser (' + app.config.get('CUSTOM_TITLE') + ')'
    else:
        title = 'Adaptyst Analyser'

    if len(app.config.get('BACKGROUND_CSS')) > 0:
        background = app.config.get('BACKGROUND_CSS')
    else:
        background = 'gray'

    return render_template(
        'viewer.html',
        ids=PerformanceAnalysisResults.get_all_folders(
            app.config['PERFORMANCE_ANALYSIS_STORAGE']),
        scripts=scripts,
        stylesheets=stylesheets,
        version='v' + version('adaptyst-analyser'),
        title=title,
        background=background,
        backends=backends,
        min_mod_vers=json.dumps(min_mod_vers))
