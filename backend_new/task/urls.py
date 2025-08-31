from django.urls import path
from . import views

urlpatterns = [
    path('/create/', views.task_list_create, name='task-list-create'),
    path('/<int:pk>/', views.task_detail, name='task-detail'),
    path('/<int:pk>/subtasks/', views.task_subtasks, name='task-subtasks'),
    path('/stats/', views.task_stats, name='task-stats'),
    path('/register/', views.register_user, name='user-register'),
]
