from django.urls import path
from . import views

urlpatterns = [
    path('api/tasks/', views.task_list_create, name='task-list-create'),
    path('api/tasks/<int:pk>/', views.task_detail, name='task-detail'),
    path('api/tasks/<int:pk>/subtasks/', views.task_subtasks, name='task-subtasks'),
    path('api/tasks/stats/', views.task_stats, name='task-stats'),
    path('api/register/', views.register_user, name='user-register'),
]
