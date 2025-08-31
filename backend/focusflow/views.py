from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from .models import Task
from .serializers import TaskSerializer, UserSerializer

# ---- TASK LIST & CREATE ----
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def task_list_create(request):
    if request.method == 'GET':
        queryset = Task.objects.filter(user=request.user)

        parent_param = request.query_params.get('parent_task')
        if parent_param is None:
            queryset = queryset.filter(parent_task__isnull=True)
        else:
            queryset = queryset.filter(parent_task_id=parent_param)

        completed_param = request.query_params.get('completed')
        category_param = request.query_params.get('category')
        search_param = request.query_params.get('search')

        if completed_param is not None:
            is_completed = str(completed_param).strip().lower() in ('true', '1', 'yes')
            queryset = queryset.filter(completed=is_completed)

        if category_param:
            queryset = queryset.filter(category__iexact=category_param)

        if search_param:
            queryset = queryset.filter(
                Q(title__icontains=search_param) | Q(description__icontains=search_param)
            )

        sort_by_param = request.query_params.get('sort_by')
        order_param = request.query_params.get('order', 'asc')

        if sort_by_param:
            allowed_sort_fields = ['due_date', 'completed', 'category', 'created_at', 'title']
            if sort_by_param in allowed_sort_fields:
                sort_field = '-' + sort_by_param if order_param.lower() == 'desc' else sort_by_param
                queryset = queryset.order_by(sort_field)
        else:
            queryset = queryset.order_by('-created_at', 'id')

        serializer = TaskSerializer(queryset, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ---- TASK DETAIL (RETRIEVE, UPDATE, DELETE) ----
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def task_detail(request, pk):
    try:
        task = Task.objects.get(pk=pk, user=request.user)
    except Task.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = TaskSerializer(task)
        return Response(serializer.data)

    elif request.method in ['PUT', 'PATCH']:
        serializer = TaskSerializer(task, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# ---- SUBTASKS ----
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_subtasks(request, pk):
    try:
        parent_task = Task.objects.get(pk=pk, user=request.user)
    except Task.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    subtasks = parent_task.subtasks.filter(user=request.user).order_by('id')
    serializer = TaskSerializer(subtasks, many=True)
    return Response(serializer.data)

# ---- STATS ----
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_stats(request):
    user_tasks = Task.objects.filter(user=request.user)
    data = {
        'total_tasks': user_tasks.count(),
        'pending_tasks': user_tasks.filter(completed=False).count(),
        'completed_tasks': user_tasks.filter(completed=True).count(),
        'overdue_tasks': user_tasks.filter(
            completed=False, due_date__lt=timezone.localdate()
        ).count(),
    }
    return Response(data)

# ---- USER REGISTRATION ----
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
