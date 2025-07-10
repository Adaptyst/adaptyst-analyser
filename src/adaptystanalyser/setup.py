# SPDX-FileCopyrightText: 2025 CERN
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-PackageName: Adaptyst Analyser: a tool for analysing performance analysis results

import sys
import argparse
import yaml
import shutil
from pathlib import Path
from importlib import import_module
from importlib.metadata import version


def main():
    parser = argparse.ArgumentParser(prog='adaptyst-setup-armodule',
                                     description='Setup utility for Adaptyst '
                                     'Analyser modules')

    parser.add_argument('module', metavar='PATH',
                        help='path to an Adaptyst Analyser module directory '
                        'to install (usually ends with the "analyser" folder)')
    parser.add_argument('--version', action='version', help='print '
                        'version and exit', version='v' + version(
                            'adaptyst-analyser'))
    parser.add_argument('-u,--update', action='store_true',
                        help='update/reinstall the module if it is already '
                        'installed')
    parser.add_argument('-e,--editable', action='store_true',
                        help='install the module in editable mode '
                        '(except root __init__.py)')

    args = parser.parse_args()

    module_path = Path(args.module)

    if not module_path.exists():
        print(f'adaptyst-setup-armodule: error: {args.module} '
              'does not exist', file=sys.stderr)
        return 1

    module_path = module_path.resolve()

    if not module_path.is_dir():
        print(f'adaptyst-setup-armodule: error: {args.module} '
              'does not point to a directory', file=sys.stderr)
        return 1

    web_path = module_path / 'web'
    python_path = module_path / 'python'
    metadata_path = module_path / 'module.yml'

    if not web_path.exists():
        print(f'adaptyst-setup-armodule: error: {web_path} '
              'does not exist', file=sys.stderr)
        return 2

    if not python_path.exists():
        print(f'adaptyst-setup-armodule: error: {python_path} '
              'does not exist', file=sys.stderr)
        return 2

    if not metadata_path.exists():
        print(f'adaptyst-setup-armodule: error: {metadata_path} '
              'does not exist', file=sys.stderr)
        return 2

    web_path_str = str(web_path)
    python_path_str = str(python_path)
    metadata_path_str = str(metadata_path)

    web_path = web_path.resolve()
    python_path = python_path.resolve()
    metadata_path = metadata_path.resolve()

    if not web_path.is_dir():
        print(f'adaptyst-setup-armodule: error: {web_path_str} '
              'does not point to a directory', file=sys.stderr)
        return 2

    if not python_path.is_dir():
        print(f'adaptyst-setup-armodule: error: {python_path_str} '
              'does not point to a directory', file=sys.stderr)
        return 2

    if not metadata_path.is_file():
        print(f'adaptyst-setup-armodule: error: {metadata_path_str} '
              'does not point to a file', file=sys.stderr)
        return 2

    try:
        with metadata_path.open('r') as f:
            metadata = yaml.safe_load(f)
    except yaml.YAMLError as e:
        print(f'adaptyst-setup-armodule: error: {metadata_path_str} '
              f'is not a valid YAML file: {e}', file=sys.stderr)
        return 2

    if 'name' not in metadata:
        print(f'adaptyst-setup-armodule: error: {metadata_path_str} '
              'does not contain a "name" field', file=sys.stderr)
        return 2

    if not (python_path / 'analysis.py').exists():
        print(f'adaptyst-setup-armodule: error: {python_path_str} '
              'does not contain an "analysis.py" file', file=sys.stderr)
        return 2

    if not (web_path / 'settings.html').exists():
        print(f'adaptyst-setup-armodule: warning: {web_path_str} '
              'does not contain a "settings.html" file, there will be '
              'no settings available for this module on the client side',
              file=sys.stderr)

    analyser_path = Path(import_module('adaptystanalyser').__file__).parent

    module_python_path = analyser_path / 'modules' / metadata['name']

    if module_python_path.exists():
        if args.update:
            shutil.rmtree(module_python_path)
        else:
            print(f'adaptyst-setup-armodule: error: {metadata["name"]} '
                  'is already installed, use the --update flag',
                  file=sys.stderr)
            return 3

    module_python_path.mkdir(parents=True)

    module_web_path = analyser_path / 'static' / 'modules' / metadata['name']

    if module_web_path.exists():
        if args.update:
            shutil.rmtree(module_web_path)
        else:
            print(f'adaptyst-setup-armodule: error: {metadata["name"]} '
                  'is already installed, use the --update flag',
                  file=sys.stderr)
            return 3

    module_web_path.mkdir(parents=True)

    def install(item, module_path):
        if item.is_dir():
            shutil.copytree(item, module_path / item.name,
                            dirs_exist_ok=True)
        else:
            shutil.copy(item, module_path / item.name)

    for item in web_path.iterdir():
        if args.editable:
            (module_web_path / item.name).symlink_to(item.resolve())
        elif item.is_symlink():
            install(item.resolve(), module_web_path)
        else:
            install(item, module_web_path)

    for item in python_path.iterdir():
        if args.editable:
            (module_python_path / item.name).symlink_to(item.resolve())
        elif item.is_symlink():
            install(item.resolve(), module_python_path)
        else:
            install(item, module_python_path)

    if (python_path / '__init__.py').exists():
        init_py_text = (python_path / '__init__.py').read_text()

        if 'from . import analysis' not in init_py_text:
            with (module_python_path / '__init__.py').open('w') as f:
                f.write(init_py_text)
                f.write('\n\n')
                f.write('# This snippet is auto-generated by '
                        'adaptyst-setup-armodule, do not edit it\n')
                f.write('from . import analysis\n')
                f.write('# End of the snippet\n')
        else:
            shutil.copy(python_path / '__init__.py',
                        module_python_path / '__init__.py')
    else:
        with (module_python_path / '__init__.py').open('w') as f:
            f.write('# This snippet is auto-generated by '
                    'adaptyst-setup-armodule, do not edit it\n')
            f.write('from . import analysis\n')
            f.write('# End of the snippet\n')

    print(f'adaptyst-setup-armodule: {metadata["name"]} '
          'installed successfully')
