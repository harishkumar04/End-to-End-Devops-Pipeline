pipeline {
 
    agent {
        label 'docker'
    }
 
    environment {
 
        IMAGE_NAME = "harishkumar09/task-app"
 
        IMAGE_TAG = "${BUILD_NUMBER}"
    }
 
    stages {
 
        stage('Clone Repository') {
 
            steps {
                checkout scm 
            }
        }
 
        stage('Build Docker Image') {
 
            steps {
 
                sh '''
                docker build -t $IMAGE_NAME:$IMAGE_TAG .
                '''
            }
        }
 
        stage('Push Docker Image') {
 
            steps {
 
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
 
                    sh '''
                    echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
 
                    docker push $IMAGE_NAME:$IMAGE_TAG
                    '''
                }
            }
        }
 
        stage('Deploy to EKS') {
 
            steps {
 
                sh '''
                sed -i "s|image:.*|image: $IMAGE_NAME:$IMAGE_TAG|g" \
                k8s/app/app-deployment.yaml
 
                kubectl apply -f k8s/
                '''
            }
        }
    }
}
