# SPDX-FileCopyrightText: 2026 CERN
# SPDX-License-Identifier: LGPL-3.0-or-later

import json
import datetime
import hashlib
import math
import sqlalchemy as sql
import sqlalchemy.orm as orm
import sqlalchemy.engine as engine
from pathlib import Path


class Base(orm.DeclarativeBase):
    def initialize(url=None, password=None):
        if url is None:
            p = Path.home() / '.adaptyst_analyser'
            p.mkdir(exist_ok=True)

            db_path = p / 'db.sqlite'
            db_path = db_path.resolve()

            database_url = 'sqlite:///' + str(db_path)
        else:
            database_url = engine.make_url(url)

            if password is not None:
                database_url.password = password

        engine = sql.create_engine(database_url, echo=True)
        Base.metadata.create_all(engine)


class Arrangement(Base):
    def _hash_token(token):
        token_salt = os.urandom(32)
        token_to_save = hashlib.pbkdf2_hmac('sha256',
                                            token.encode('utf-8'),
                                            token_salt,
                                            600000).hex()
        return token_to_save, token_salt

    def req_check_name(data):
        if 'name' not in data:
            return '', 401

        with orm.Session(engine) as session:
            results = session.scalars(
                sql.select(arrgmts.Arrangement).where(
                    Arrangement.name == data['name']))

            if results.first() is None:
                return '', 404
            else:
                return '', 200

    def req_check_token(data):
        if 'name' not in data or \
           'token' not in data:
            return '', 401

        with orm.Session(engine) as session:
            results = session.scalars(
                sql.select(arrgmts.Arrangement).where(
                    arrgmts.Arrangement.name == data['name']))
            arrgmt = results.first()

            if arrgmt is None:
                return '', 404

            if not arrgmt.check_token(data['token']):
                return '', 403

            return '', 200

    def req_save(data):
        if 'name' not in data or \
           'data' not in data:
            return '', 401

        with orm.Session(engine) as session:
            results = session.scalars(
                sql.select(arrgmts.Arrangement).where(
                    arrgmts.Arrangement.name == data['name']))
            arrgmt = results.first()

            data_decoded = json.loads(data['data'])
            if 'main_window' in data_decoded:
                a_type = 'SW'
            else:
                a_type = 'W'

            token_to_return = None
            if arrgmt is None:
                token_to_return = os.urandom(32).hex()
                token_to_save, token_salt = \
                    Arrangement._hash_token(token_to_return)
                arrgmt = arrgmts.Arrangement(name=data['name'],
                                             a_type=a_type,
                                             last_update=datetime.now(
                                                 datetime.timezone.UTC),
                                             token=token_to_save,
                                             token_salt=token_salt,
                                             data=data['data'])
                session.add(arrgmt)
            else:
                if 'token' not in data:
                    return '', 403

                if not arrgmt.check_token(data['token']):
                    return '', 403

                arrgmt.a_type = a_type
                arrgmt.last_update = datetime.now(datetime.timezone.UTC)
                arrgmt.data = data['data']

            session.commit()

            if token_to_return is not None:
                return json.dumps({
                    'token': token_to_return
                }), 200

            return '', 200

    def req_edit_name(data):
        if 'name' not in data or \
           'new_name' not in data:
            return '', 401

        if 'token' not in data:
            return '', 403

        with orm.Session(engine) as session:
            results_new_name_check = session.scalars(
                sql.select(arrgmts.Arrangement).where(
                    arrgmts.Arrangement.name == data['new_name']))

            if results_new_name_check.first() is not None:
                return '', 409

            results = session.scalars(
                sql.select(arrgmts.Arrangement).where(
                    arrgmts.Arrangement.name == data['name']))
            arrgmt = results.first()

            if arrgmt is None:
                return '', 404

            if not arrgmt.check_token(data['token']):
                return '', 403

            arrgmt.name = data['new_name']
            arrgmt.last_update = datetime.now(datetime.timezone.UTC)
            session.commit()

            return '', 200

    def req_delete(data):
        if 'name' not in data:
            return '', 401

        if 'token' not in data:
            return '', 403

        with orm.Session(engine) as session:
            results = session.scalars(
                sql.select(arrgmts.Arrangement).where(
                    arrgmts.Arrangement.name == data['name']))
            arrgmt = results.first()

            if arrgmt is None:
                return '', 404

            if not arrgmt.check_token(data['token']):
                return '', 403

            session.delete(arrgmt)
            session.commit()

            return '', 200

    def req_get(data):
        if 'name' not in data:
            return '', 401

        with orm.Session(engine) as session:
            results = session.scalars(
                sql.select(arrgmts.Arrangement).where(
                    arrgmts.Arrangement.name == data['name']))
            arrgmt = results.first()

            if arrgmt is None:
                return '', 404

            return arrgmt.data, 200

    def req_list(data):
        limit = data.get('limit', 10)
        page = data.get('page', 1)
        sort = data.get('sort', 'last_update_desc')
        types = data.get('types', 'both')

        if not isinstance(limit, int) or \
           not isinstance(page, int):
            return '', 401

        if sort == 'last_update_desc':
            order_by = sql.desc(arrgmts.Arrangement.last_update)
        elif sort == 'last_update_asc':
            order_by = sql.asc(arrgmts.Arrangement.last_update)
        elif sort == 'name_desc':
            order_by = sql.desc(arrgmts.Arrangement.name)
        elif sort == 'name_asc':
            order_by = sql.asc(arrgmts.Arrangement.name)
        else:
            return '', 401

        if types == 'both':
            where = True
        elif types == 'W':
            where = arrgmts.Arrangement.a_type == 'W'
        elif types == 'SW':
            where = arrgmts.Arrangement.a_type == 'SW'
        else:
            return '', 401

        with orm.Session(engine) as session:
            results = session.scalars(
                sql.select(arrgmt.Arrangements).where(where).order_by(
                    order_by).limit(limit).offset((page - 1) * limit))
            cnt = session.scalar(sql.select(sql.count(arrgmt.Arrangements)))

            return json.dumps({
                'general_total_pages': (cnt // limit) + (1 if cnt % limit > 0 else 0),
                'list': list(results)
            }), 200

    __tablename__ = 'arrangement'

    a_id: orm.Mapped[int] = orm.mapped_column(primary_key=True)
    name: orm.Mapped[str] = orm.mapped_column(unique=True)
    a_type: orm.Mapped[str]
    last_update: orm.Mapped[datetime.datetime]
    token: orm.Mapped[str]
    token_salt: orm.Mapped[bytes]
    data: orm.Mapped[str]

    def check_token(self, user_token):
        hashed_token = hashlib.pbkdf2_hmac('sha256',
                                           user_token.encode('utf-8'),
                                           self.token_salt,
                                           600000).hex()
        return hashed_token == self.token

    def __str__(self):
        return json.dumps({
            'id': self.a_id,
            'name': self.name,
            'type': self.a_type,
            'last_update': self.last_update,
            })


class Session(Base):
    __tablename__ = 'session'

    a_id: orm.Mapped[int] = orm.mapped_column(
        sql.ForeignKey('arrangement.a_id'),
        primary_key=True)
    name: orm.Mapped[str] = orm.mapped_column(primary_key=True)
    fingerprint: orm.Mapped[str]
    last_update_or_check: orm.Mapped[datetime.datetime]
