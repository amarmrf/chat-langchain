FROM python:3.11-buster

WORKDIR /app

RUN pip install poetry==1.5.1

RUN poetry config virtualenvs.create false

# Copy project files
COPY ./pyproject.toml ./poetry.lock* ./README.md ./

RUN poetry install --no-interaction --no-ansi --no-root --without lint

# Create backend directory and copy files
RUN mkdir -p backend
COPY ./backend/*.py ./backend/

# Install the project
RUN poetry install --no-interaction --no-ansi

# Command to run the application
CMD exec uvicorn --app-dir=backend main:app --host 0.0.0.0 --port 8080
