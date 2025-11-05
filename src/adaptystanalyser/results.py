# SPDX-FileCopyrightText: 2025 CERN
# SPDX-License-Identifier: GPL-3.0-or-later

import json
import yaml
import random
import html
from pathlib import Path
from collections import defaultdict


class Identifier:
    """
    A class representing a performance analysis session identifier.
    """

    def __init__(self, result: Path):
        """
        Construct an Identifier object, checking the correctness
        of the supplied result folder.

        :param pathlib.Path result: A performance analysis session folder.
        :raises ValueError: When a provided folder doesn't exist or is incorrect.
        """
        if not (result / 'dirmeta.json').exists():
            raise ValueError(str(result / 'dirmeta.json') + ' does not exist!')

        with (result / 'dirmeta.json').open(mode='r') as f:
            metadata = json.load(f)

        if 'year' not in metadata or \
           'month' not in metadata or \
           'day' not in metadata or \
           'hour' not in metadata or \
           'minute' not in metadata or \
           'second' not in metadata or \
           'label' not in metadata:
            raise ValueError('The metadata do not have all the required fields!')

        self._year, self._month, self._day, self._hour, self._minute, \
            self._second, self._label = metadata['year'], \
            metadata['month'], \
            metadata['day'], metadata['hour'], metadata['minute'], \
            metadata['second'], metadata['label']

        if self._month < 10:
            self._month = '0' + str(self._month)
        else:
            self._month = str(self._month)

        if self._day < 10:
            self._day = '0' + str(self._day)
        else:
            self._day = str(self._day)

        if self._hour < 10:
            self._hour = '0' + str(self._hour)
        else:
            self._hour = str(self._hour)

        if self._minute < 10:
            self._minute = '0' + str(self._minute)
        else:
            self._minute = str(self._minute)

        if self._second < 10:
            self._second = '0' + str(self._second)
        else:
            self._second = str(self._second)

        self._id_str = result.name

    def __str__(self):
        """
        Return a user-friendly string representation of the identifier in
        form of "<label> ( <year>-<month>-<day> <hour>:<minute>:<second>)".
        """
        return f'{self._label} (' \
            f'{self._year}-{self._month}-{self._day} ' \
            f'{self._hour}:{self._minute}:{self._second})'

    @property
    def label(self):
        return self._label

    @property
    def year(self):
        return int(self._year)

    @property
    def month(self):
        return int(self._month)

    @property
    def day(self):
        return int(self._day)

    @property
    def hour(self):
        return int(self._hour)

    @property
    def minute(self):
        return int(self._minute)

    @property
    def second(self):
        if self._second is not None:
            return int(self._second)

        return None

    @property
    def value(self):
        return self._id_str

    def __eq__(self, other):
        return self.value == other.value

    def __hash__(self):
        return hash(self.value)


class PerformanceAnalysisResults:
    """
    A class describing the results of a specific performance analysis
    session stored inside a given results directory.
    """

    def get_all_folders(path_str: str) -> list:
        """
        Get the folders of all performance analysis sessions stored in
        a given results directory.

        :param str path_str: The path string to a performance analysis
                             results directory.
        :return: The list of folders that can be used
                 for constructing a PerformanceAnalysisResults object.
        """
        ids = []
        path = Path(path_str)

        for x in filter(Path.is_dir, path.glob('*')):
            try:
                identifier = Identifier(x)
            except ValueError:
                continue

            ids.append(identifier)

        return list(sorted(ids, key=lambda x: (-x.year,
                                               -x.month,
                                               -x.day,
                                               -x.hour,
                                               -x.minute,
                                               -x.second,
                                               x.label)))

    def __init__(self, performance_analysis_storage: str, folder: str):
        """
        Construct a PerformanceAnalysisResults object.

        :param str performance_analysis_storage: The path string to a
                                                 performance analysis
                                                 results directory.
        :param str folder: The folder of a performance analysis session
                           stored inside the results directory.
                           Call get_all_folders() for the list of all
                           valid folders.
        """
        self._path = Path(performance_analysis_storage) / folder
        self._identifier = Identifier(self._path)

        with (self._path / 'system' / 'system.yml').open(mode='r') as f:
            self._system = yaml.safe_load(f)

        self._used_module_vers = defaultdict(lambda: defaultdict(dict))

        for entity_name, entity in self._system['entities'].items():
            for node, settings in entity['nodes'].items():
                for mod in settings['modules']:
                    name = mod['name']
                    mod_meta_path = self._path / 'system' / entity_name / \
                        node / name / 'dirmeta.json'

                    if not mod_meta_path.exists():
                        continue

                    with mod_meta_path.open(mode='r') as f:
                        mod_meta = json.load(f)

                    if 'version' not in mod_meta:
                        continue

                    self._used_module_vers[entity_name][node][name] = \
                        mod_meta['version']

        if (self._path / 'entity_colours.json').exists():
            with (self._path / 'entity_colours.json').open(mode='r') as f:
                self._entity_colours = json.load(f)
        else:
            self._entity_colours = {}

        self._entity_exit_codes = {}

        for entity_dir in (self._path / 'system').glob('*'):
            if not entity_dir.is_dir():
                continue

            if not (entity_dir / 'dirmeta.json').exists():
                continue

            with (entity_dir / 'dirmeta.json').open(mode='r') as f:
                metadata = json.load(f)

            self._entity_exit_codes[entity_dir.name] = \
                metadata.get('exit_code', -1)

    def _set_entity_colour(self, entity, colour):
        self._entity_colours[entity] = colour

        with (self._path / 'entity_colours.json').open(mode='w') as f:
            f.write(json.dumps(self._entity_colours))

    def get_system_graph(self):
        used_colours = set()
        entities = {}

        for entity in self._system['entities'].keys():
            exit_code = self._entity_exit_codes.get(entity, -1)
            entity = html.escape(entity)
            entities[entity] = [exit_code, '#808080']

            if entity in self._entity_colours:
                used_colours.add(self._entity_colours[entity])
                entities[entity][1] = self._entity_colours[entity]
            else:
                colour = (random.randrange(100, 181, 10),
                          random.randrange(100, 181, 10),
                          random.randrange(100, 181, 10))

                while colour in used_colours:
                    colour = (random.randrange(100, 181, 10),
                              random.randrange(100, 181, 10),
                              random.randrange(100, 181, 10))

                used_colours.add(colour)
                entities[entity][1] = f'#{colour[0]:02x}{colour[1]:02x}{colour[2]:02x}'
                self._set_entity_colour(entity, entities[entity][1])

        return json.dumps({
            'entities': entities,
            'system': {
                'options': {
                    'allowSelfLoops': False,
                    'multi': False,
                    'type': 'directed'
                },
                'nodes': [
                    {
                        'key': f'{entity}_{k}',
                        'attributes': {
                            'x': random.random(),
                            'y': random.random(),
                            'label': f'[{entity}] {k}',
                            'server_id': k,
                            'size': 40,
                            'color': entities[html.escape(entity)][1],
                            'entity': entity,
                            'backends': [[x['name'],
                                          self._used_module_vers[entity][k].get(x['name'], [])]
                                          for x in v['modules']]
                        }
                    }
                    for entity in self._system['entities'].keys()
                    for k, v in self._system['entities'][entity]['nodes'].items()
                ],
                'edges': [
                    {
                        'key': f'{entity}_{k}',
                        'source': f'{entity}_{v["from"]}',
                        'target': f'{entity}_{v["to"]}',
                        'undirected': False,
                        'attributes': {
                            'label': k,
                            'size': 10
                        }
                    }
                    for entity in self._system['entities'].keys()
                    for k, v in self._system['entities'][entity]['edges'].items()
                ] + [
                    {
                        'key': k,
                        'source': f'{v["from"]["entity"]}_{v["from"]["node"]}',
                        'target': f'{v["to"]["entity"]}_{v["to"]["node"]}',
                        'undirected': False,
                        'attributes': {
                            'label': k,
                            'size': 10
                        }
                    }
                    for k, v in self._system.get('edges', {}).items()
                ]
            }
        })
