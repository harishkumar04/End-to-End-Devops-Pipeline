# End-to-End-Devops-Pipeline

A Node.js REST API for task management, built with a full DevOps pipeline for production deployment.
**Tech Stack** : Node.js · Express · PostgreSQL · Docker · Kubernetes · Jenkins · Prometheus · Grafana · Loki · Helm · Ingress + DNS

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg)


## What it does:

- REST API with 4 endpoints: GET /health, GET /tasks, POST /tasks, DELETE /tasks/:id
- Stores tasks in a PostgreSQL database
- Exposes a GET /metrics endpoint for Prometheus monitoring

## DevOps Setup:

- Dockerized with a node:20-alpine image
- Deployed on Kubernetes (EKS) with separate manifests for the app and PostgreSQL (StatefulSet with PV/PVC)
- Jenkins CI/CD pipeline — builds the Docker image, pushes to DockerHub (harishkumar09/task-app), and deploys to EKS via kubectl
- Monitoring with Prometheus (ServiceMonitor + custom values) and Loki for log aggregation, with Ingress configured for the monitoring stack

---

# Installing tools

## awscli

```shell
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
sudo apt install unzip -y
unzip awscliv2.zip
sudo ./aws/install

aws --version
```

## kubectl

```shell
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

kubectl version --client
```

## Helm

```shell
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

## eksctl 

```shell
curl --silent --location \
"https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" \
| tar xz -C /tmp

sudo mv /tmp/eksctl /usr/local/bin

eksctl version
```

Before creating the EKS Cluster create a access key from the IAM and then do this

```shell
aws configure
```

# Create the EKS Cluster

```shell
eksctl create cluster \
--name devops-project \
--region ap-south-1 \
--nodegroup-name workers \
--node-type t3.medium \
--nodes 2
```

# Creating k8s resources

Apply the k8s manifest files in the order mentioned below

```shell
Namespace.yaml -> Postgres-secret.yaml -> postgres-pv.yaml -> postgres-pvc.yaml -> postgres-headlessservice.yaml -> postgres-statefulset.yaml
```

# Build and push docker image

```docker
docker buildx build \
--platform linux/amd64 \
-t harishkumar09/task-app:v1 \
--push .
```

I am mentioning here the platform specifically because my Jenkins agent is an Amazon Linux machine which is AMD64 where as my local system is a MacOS which is ARM64.

# Deploy the app and service

```shell
kubectl apply -f k8s/app/app-deployment.yaml
kubectl apply -f k8s/app/app-service.yaml
```

## Verify Application

```shell
kubectl port-forward svc/task-app-service 3000:80 -n devops-project
```

# Creating the Database table

```shell
kubectl exec -it postgres-0 -n devops-project -- bash
psql -U postgres -d taskdb
```

```sql
CREATE TABLE tasks(
id SERIAL PRIMARY KEY,
title TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

# Test the Application

```shell
curl -X POST http://localhost:3000/tasks \
-H "Content-Type: application/json" \
-d '{"title":"Deploy EKS"}'
```

## Get tasks

```shell
curl http://localhost:3000/tasks
```

# Helm for Ingress-Nginx

```shell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
```

```shell
helm repo update
```

## Install Ingress-Nginx

```shell
helm install ingress-nginx \
ingress-nginx/ingress-nginx \
--namespace ingress-nginx \
--create-namespace
```

## Verify Controller

```shell
kubectl get pods -n ingress-nginx
```

Expected:

```shell
ingress-nginx-controller
```

## Verify Load Balancer

```shell
kubectl get svc -n ingress-nginx
```

```shell
NAME                                 TYPE           CLUSTER-IP      EXTERNAL-IP                                                                PORT(S)                      AGE
ingress-nginx-controller             LoadBalancer   10.100.63.147   aab9f51cc68714928b5278d6ca3bd641-1147321344.ap-south-1.elb.amazonaws.com   80:32649/TCP,443:31968/TCP   25s
ingress-nginx-controller-admission   ClusterIP      10.100.190.39   <none>                                                                     443/TCP                      25s
```
---

# Create Ingress Resource

```shell
kubectl apply -f k8s/app/app-ingress.yaml
```

This will create a load balancer for the application

## Access Application
Open browser:

```shell
http://<EXTERNAL-IP>
OR:
http://<ELB-DNS>
```
This will hit the Node.js app.

### TEST
Health Endpoint

```shell
http://<EXTERNAL-IP>/health
```
### Create Task

```shell
curl -X POST http://<EXTERNAL-IP>/tasks \
-H "Content-Type: application/json" \
-d '{"title":"learn ingress"}'
```

# Monitoring

## Install Loki 

## Install the kube-prometheus-stack helm chart

```shell
helm repo add prometheus-community \
https://prometheus-community.github.io/helm-charts
```

```shell
helm repo update
```

```shell
helm install monitoring \
prometheus-community/kube-prometheus-stack \
--namespace monitoring \
--create-namespace
```

### Verify Pods

```shell
kubectl get pods -n monitoring
```

### Verify Services

```shell
kubectl get services -n monitoring
```

Output:
The services installed by this helm chart are

```shell
monitoring-grafana
monitoring-kube-prometheus-prometheus
```
## Access Grafana

### Port-forward:

```shell
kubectl port-forward svc/monitoring-grafana \
3000:80 \
-n monitoring
```

In the browser,

```shell
http://localhost:3000
```
### Get Grafana Password

Username:

```shell
admin
```
Password:

```shell
kubectl get secret monitoring-grafana \
-n monitoring \
-o jsonpath="{.data.admin-password}" | base64 --decode
```
# Add Application Metrics

Currently Prometheus monitors cluster infrastructure.
Now we expose:

```shell
/metrics
```
from Node.js app.

# Install prom-client

Inside app:

```shell
npm install prom-client
```
# Update server.js
Add:

```js
const client = require("prom-client");
client.collectDefaultMetrics();
const register = client.register;
Add Metrics Endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
})
```
