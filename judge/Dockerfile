FROM eclipse-temurin:17-jdk-jammy
RUN apt-get update && apt-get install -y --no-install-recommends python3 g++ && rm -rf /var/lib/apt/lists/*
COPY runner.py /opt/runner.py
WORKDIR /work
ENTRYPOINT ["python3", "-I", "/opt/runner.py"]
