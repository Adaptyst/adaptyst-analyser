# SPDX-FileCopyrightText: 2025 CERN
# SPDX-License-Identifier: GPL-3.0-or-later

FROM python:latest

RUN apt-get update && apt-get dist-upgrade -y && apt-get install -y nodejs npm

WORKDIR /app
RUN mkdir adaptyst-analyser
COPY . adaptyst-analyser/
RUN pip install adaptyst-analyser/ && rm -rf adaptyst-analyser
RUN chgrp -R 0 /app && chmod -R g+rwX /app

EXPOSE 8000
ENTRYPOINT ["gunicorn", "-b", "0.0.0.0:8000", "adaptystanalyser.app:app"]
