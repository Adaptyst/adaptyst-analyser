# SPDX-FileCopyrightText: 2025 CERN
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-PackageName: Adaptyst Analyser: a tool for analysing performance analysis results

import argparse
import sys
import subprocess
import os
from pathlib import Path
from importlib.metadata import version


def main():
    parser = argparse.ArgumentParser(prog='adaptyst-analyser',
                                     description='Adaptyst Analyser web server')

    parser.add_argument('results', metavar='PATH',
                        help='path to a profiling results directory '
                        '(relative or absolute)')
    parser.add_argument('--version', action='version', help='print '
                        'version and exit', version='v' + version(
                            'adaptyst-analyser'))
    parser.add_argument('-a',
                        metavar='ADDR',
                        dest='address',
                        help='address and port to bind to, '
                        'default: 127.0.0.1:8000',
                        default='127.0.0.1:8000')
    parser.add_argument('-o',
                        metavar='INT FROM 0 TO 100',
                        dest='off_cpu_sampling',
                        type=int,
                        help='default off-CPU timeline display scale for '
                        'users (the value is an integer between 0 '
                        'and 100 inclusive converted to the scale between '
                        '0.0 and 1.0, where 0.0 means "do not display '
                        'any off-CPU periods on the timeline", 1.0 means '
                        '"display all off-CPU periods on the timeline", '
                        'and anything in-between means "sample off-CPU '
                        'periods on the timeline in a similar way Adaptyst '
                        'does during profiling, with the sampling frequency '
                        'being higher with higher values") (default: 100)',
                        default=100)

    args = parser.parse_args()

    if args.off_cpu_sampling < 0 or \
       args.off_cpu_sampling > 100:
        print('adaptyst-analyser: error: -o must specify an integer '
              'between 0 and 100 inclusive', file=sys.stderr)
        return 1

    result_path = Path(args.results)

    if not result_path.exists():
        print(f'adaptyst-analyser: error: {result_path} does not exist',
              file=sys.stderr)
        return 1
    elif not result_path.is_dir():
        print(f'adaptyst-analyser: error: {result_path} is not a directory',
              file=sys.stderr)
        return 1

    result_path = result_path.resolve()

    env = os.environ.copy()
    env.update({
        'FLASK_PROFILING_STORAGE': str(result_path),
        'FLASK_OFFCPU_SAMPLING': str(args.off_cpu_sampling / 100)
    })

    try:
        return subprocess.run(['gunicorn', '-b', args.address,
                               'adaptystanalyser.app:app'],
                              env=env).returncode
    except KeyboardInterrupt:
        return 130
