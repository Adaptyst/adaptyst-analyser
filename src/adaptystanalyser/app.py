# SPDX-FileCopyrightText: 2025 CERN
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-PackageName: Adaptyst Analyser: a tool for analysing performance analysis results

import traceback
import re
from flask import Flask, render_template, request
from pathlib import Path
from . import PerformanceAnalysisResults, Identifier
from importlib.metadata import version
from importlib import import_module


app = Flask(__name__)
app.config.from_prefixed_env()


if 'PERFORMANCE_ANALYSIS_STORAGE' not in app.config:
    raise RuntimeError('Please set FLASK_PERFORMANCE_ANALYSIS_STORAGE environment '
                       'variable to the absolute path to a directory where '
                       'Adaptyst performance analysis results are stored.')


static_path = Path(app.root_path) / 'static'
scripts = list(sorted(map(lambda x: x.name,
                          static_path.glob('*.js'))))
stylesheets = list(sorted(map(lambda x: x.name,
                              static_path.glob('*.css')))) + \
    list(sorted(map(lambda x: 'modules/' + x.name,
                    static_path.glob('modules/*.css'))))
d3_flamegraph_css = (static_path / 'd3-flamegraph.css').read_text()

backends = []

for p in static_path.glob('modules/*_settings.html'):
    backend = {}
    backend['name'] = re.search(r'^(.+)_settings\.html$', p.name).group(1)
    backend['settings_code'] = p.read_text()
    backends.append(backend)


@app.get('/<identifier>/')
def get(identifier):
    try:
        results = PerformanceAnalysisResults(
            app.config['PERFORMANCE_ANALYSIS_STORAGE'],
            identifier)
        return results.get_system_graph()
    except ValueError:
        return '', 404


@app.post('/<identifier>/<node>/')
def post(identifier, node):
    try:
        results = PerformanceAnalysisResults(
            app.config['PERFORMANCE_ANALYSIS_STORAGE'],
            identifier)
        backend_name = results.get_backend_name(node)

        if backend_name is None:
            return '', 404

        backend = import_module(f'adaptystanalyser.modules.{backend_name}')
        return backend.process(app.config['PERFORMANCE_ANALYSIS_STORAGE'],
                               identifier, node, request.values)
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
        d3_flamegraph_css=d3_flamegraph_css.replace('\n', ' '),
        version='v' + version('adaptyst-analyser'),
        title=title,
        background=background,
        backends=backends)
