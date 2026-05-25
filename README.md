# End-to-End-Devops-Pipeline

## INSTALL POSTGRES CHART

```shell
helm install postgres ./postgres \
-n devops-project
```

## INSTALL APP CHART

```shell
helm install task-app ./task-app \
-n devops-project
```

## VERIFY

```shell
kubectl get all -n devops-project
```

## JENKINS PIPELINE CODE CHANGES

Instead of:

```shell
kubectl apply -f k8s/
```
you do:

```shell
helm upgrade --install task-app ./helm/task-app \
-n devops-project \
--set image.tag=${BUILD_NUMBER}
```

