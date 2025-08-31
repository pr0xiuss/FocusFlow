from rest_framework import viewsets, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from task.models import Task
from task.serializers import TaskSerializer, UserSerializer


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_nested_subtasks(self,task,user):
        subtasks=task.subtasks.filter(user=user).order_by('id')
        result=[]

        for subtask in subtasks:
            subtask_data=TaskSerializer(subtask).data
            has_nested=subtask.subtasks.filter(user=user).exists()
            subtask_data['has_subtasks']=has_nested

            if has_nested:
                subtask_data['subtasks']=self.get_nested_subtasks(subtask,user)
            else:
                subtask_data['subtasks']=[]
        
        return result

    def get_queryset(self):
        queryset = Task.objects.filter(user=self.request.user)
        parent_param = self.request.query_params.get('parent_task', None)

        if parent_param is None:
            queryset = queryset.filter(parent_task__isnull=True)
        else:
            queryset = queryset.filter(parent_task_id=parent_param)

    # filtering (completed, category, search) and sorting logic stays same
        completed_param=self.request.query_params.get('completed')
        category_param=self.request.query_params.get('category')
        search_param=self.request.query_params.get('search')

        if completed_param is not None:
            is_completed=str(completed_param).strip().lower() in ('true','1','yes')
            queryset=queryset.filter(completed=is_completed)

        if category_param:
            queryset=queryset.filter(category__iexact=category_param)

        if search_param:
            queryset=queryset.filter( Q(title__icontains=search_param) | Q(description__icontains=search_param))

        sort_by_param=self.request.query_params.get('sort_by')
        order_param=self.request.query_params.get('order', 'asc')

        if sort_by_param:
            allowed_sort_fields=['due_date','completed','category','created_at','title']
            if sort_by_param in allowed_sort_fields:
                sort_field='-'+sort_by_param if order_param.lower()=='desc' else sort_by_param
                queryset=queryset.order_by(sort_field)
        else:
            queryset=queryset.order_by('-created_at','id')

        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False,methods=['get'])
    def stats(self, request):
        user_tasks=Task.objects.filter(user=request.user)
        data={
            'total_tasks': user_tasks.count(),
            'pending_tasks': user_tasks.filter(completed=False).count(),
            'completed_tasks': user_tasks.filter(completed=True).count(),
            'overdue_tasks': user_tasks.filter(completed=False, due_date__lt=timezone.localdate()).count(),
        }
        return Response(data)

    @action(detail=True,methods=['get'])
    def subtasks(self,request,pk=None):
        parent_task =self.get_object()
        subtasks = parent_task.subtasks.filter(user=request.user).order_by('id')
        serializer = self.get_serializer(subtasks, many=True)
        return Response(serializer.data)


class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]
