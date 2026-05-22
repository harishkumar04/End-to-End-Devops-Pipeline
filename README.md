# End-to-End-Devops-Pipeline

A Node.js REST API for task management, built with a full DevOps pipeline for production deployment.

![Docker](https://img.shields.io/badge/docker-2496ED?style=flat&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/kubernetes-326CE5?style=flat&logo=kubernetes&logoColor=white)
![Amazon EKS](https://img.shields.io/badge/Amazon%20EKS-FF9900?style=flat&logo=amazon-eks&logoColor=white)
![Jenkins](https://img.shields.io/badge/jenkins-D24939?style=flat&logo=jenkins&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Prometheus](https://img.shields.io/badge/prometheus-E6522C?style=flat&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/grafana-F46800?style=flat&logo=grafana&logoColor=white)
![Loki](https://img.shields.io/badge/loki-F2CC0C?style=flat&logo=grafana&logoColor=black)
![Cloudflare](https://img.shields.io/badge/cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white)
![Ingress](https://img.shields.io/badge/ingress-009639?style=flat&logo=nginx&logoColor=white)
![Helm](https://img.shields.io/badge/helm-0F1689?style=flat&logo=helm&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgresql-4169E1?style=flat&logo=postgresql&logoColor=white)

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

# Create the servicemonitor

This tells prometheus to scrape these metrics too

```shell
kubectl apply -f k8s/app/servicemonitor.yaml
```

# Monitoring

## Install Loki Chart

```shell
helm install loki grafana/loki-stack --namespace monitoring
```

This will Promtail and Loki except Grafana which is not installed by default by this chart.

```shell
kubectl get svc -n monitoring
```

Remember the Service name of the loki since it has to be added as the Data source for the Grafana in the next step

## Install the kube-prometheus-stack helm chart

```shell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts -n monitoring
```

```shell
helm repo update
```

Now we need to add loki as the datasource so do this

```shell
vim values.yaml
```
and then add these lines

```yml
grafana:
     additionalDataSources:
       - name: Loki
         type: loki
         url: http://loki.monitoring.svc.cluster.local:3100
         access: proxy
         isDefault: false
```

Upgrade the chart,

```shell
helm upgrade monitoring prometheus-community/kube-prometheus-stack -n monitoring -f values.yaml
```

## Updating for prometheus

By default the prometheus uses only those servicemonitors that are in the same namespace as the where the chart is installed and the label of the servicemonitor should have the same label as the Helm release name like this

```yml
metadata:
  labels:
     release: monitoring
```

but in our case the servicemonitor is in another namespace so we need to update the values.yaml file again

```shell
helm get values monitoring prometheus-community/kube-prometheus-stack -n monitoring -o yaml > latest_values.yaml
```
Add these lines,

```yml
prometheus:
  prometheusSpec:
    serviceMonitorSelectorNilUsesHelmValues: false
    serviceMonitorSelector: {}
    serviceMonitorNamespaceSelector: {}
```

```shell
helm upgrade monitoring prometheus-community/kube-prometheus-stack -n monitoring -f latest_values.yaml
```

### Verify Pods

```shell
kubectl get pods -n monitoring
```

### Verify Services

```shell
kubectl get services -n monitoring
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

